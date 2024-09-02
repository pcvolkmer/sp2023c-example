use std::collections::BTreeMap;
use std::str::FromStr;
use std::time::Duration;
use std::{env, fs};

use askama::Template;
use axum::body::Body;
use axum::extract::{Path, Query};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use csv::{ReaderBuilder, StringRecord};
use include_dir::{include_dir, Dir};
use itertools::Itertools;
use lazy_static::lazy_static;
use moka::future::Cache;
use serde::{Deserialize, Serialize};
#[cfg(debug_assertions)]
use tower_http::trace::TraceLayer;

static AGS_CSV: &str = include_str!("resources/ags.csv");

static ASSETS: Dir = include_dir!("src/resources/assets");

lazy_static! {
    static ref DISTRICT_POPULATIONS: Vec<DistrictPopulation> = ReaderBuilder::new()
        .from_reader(AGS_CSV.as_bytes())
        .records()
        .flatten()
        .map(|record| DistrictPopulation::from_record(&record))
        .unique_by(|e| e.ags.to_string())
        .chunk_by(|e| e.ags[0..5].to_string())
        .into_iter()
        .map(|district| DistrictPopulation {
            ags: district.0,
            population: district.1.map(|e| e.population).sum(),
        })
        .collect_vec();
}

lazy_static! {
    static ref DISTRICT_NAMES: BTreeMap<String, String> = ReaderBuilder::new()
        .from_reader(AGS_CSV.as_bytes())
        .records()
        .flatten()
        .map(|record| (
            record.get(0).unwrap()[0..5].to_string(),
            if record.get(3).unwrap().is_empty() {
                record.get(2).unwrap()
            } else {
                record.get(3).unwrap()
            }
            .to_string()
        ))
        .unique()
        .collect::<BTreeMap<_, _>>();
}

#[derive(Serialize, Deserialize, Clone)]
struct Entry {
    icd10: String,
    ags: String,
    diagnosis_year: u32,
    birth_decade: u32,
    sex: String,
    count: u32,
}

impl Entry {
    fn from_record(record: &StringRecord) -> Self {
        Self {
            icd10: record.get(0).unwrap().to_string(),
            ags: record.get(1).unwrap().to_string(),
            diagnosis_year: u32::from_str(record.get(2).unwrap()).unwrap(),
            birth_decade: u32::from_str(record.get(3).unwrap()).unwrap(),
            sex: record.get(4).unwrap().to_string(),
            count: u32::from_str(record.get(5).unwrap()).unwrap_or(0),
        }
    }
}

#[derive(Clone)]
struct DistrictPopulation {
    ags: String,
    population: u32,
}

impl DistrictPopulation {
    fn from_record(record: &StringRecord) -> Self {
        Self {
            ags: record.get(0).unwrap().to_string(),
            population: u32::from_str(record.get(10).unwrap_or("0")).unwrap_or(0),
        }
    }
}

// statistics

#[derive(Serialize)]
struct Statistics {
    icd10: Vec<StatisticsEntry>,
    diagnosis_year: Vec<StatisticsEntry>,
    birth_decade: Vec<StatisticsEntry>,
    sex: Vec<StatisticsEntry>,
}

#[derive(Serialize)]
struct StatisticsEntry {
    name: String,
    value: u32,
}

//

#[derive(Deserialize)]
struct Filter {
    #[serde(rename = "ags", default)]
    ags: String,

    #[serde(rename = "en", default)]
    entity: String,

    #[serde(rename = "df", default)]
    diagnosis_year_min: String,

    #[serde(rename = "dt", default)]
    diagnosis_year_max: String,

    #[serde(rename = "bf", default)]
    birth_decade_min: String,

    #[serde(rename = "dt", default)]
    birth_decade_max: String,

    #[serde(rename = "s", default)]
    sex: String,

    #[serde(rename = "absolut", default)]
    absolute: String,
}

#[derive(Template)]
#[template(path = "index.html")]
struct IndexTemplate {}

fn all_entries() -> Vec<Entry> {
    let data_file = env::var("SAMPLE_DATA_FILE").unwrap_or("/data/sample.csv".to_string());
    if let Ok(data) = fs::read_to_string(data_file) {
        return ReaderBuilder::new()
            .from_reader(data.as_bytes())
            .records()
            .flatten()
            .map(|record| Entry::from_record(&record))
            .collect_vec();
    }

    vec![]
}

fn get_statistics(entries: &[Entry]) -> Statistics {
    Statistics {
        icd10: entries
            .iter()
            .sorted_by_key(|e| e.icd10.to_string())
            .chunk_by(|e| e.icd10.to_string())
            .into_iter()
            .map(|(name, e)| StatisticsEntry {
                name,
                value: e.map(|e| e.count).sum(),
            })
            .collect_vec(),
        diagnosis_year: entries
            .iter()
            .sorted_by_key(|e| e.diagnosis_year.to_string())
            .chunk_by(|e| e.diagnosis_year.to_string())
            .into_iter()
            .map(|(name, e)| StatisticsEntry {
                name,
                value: e.map(|e| e.count).sum(),
            })
            .collect_vec(),
        birth_decade: entries
            .iter()
            .sorted_by_key(|e| e.birth_decade.to_string())
            .chunk_by(|e| e.birth_decade.to_string())
            .into_iter()
            .map(|(name, e)| StatisticsEntry {
                name,
                value: e.map(|e| e.count).sum(),
            })
            .collect_vec(),
        sex: entries
            .iter()
            .sorted_by_key(|e| e.sex.to_string())
            .chunk_by(|e| e.sex.to_string())
            .into_iter()
            .map(|(name, e)| StatisticsEntry {
                name,
                value: e.map(|e| e.count).sum(),
            })
            .collect_vec(),
    }
}

async fn query_config() -> Response {
    let mut result = BTreeMap::new();
    result.insert(
        "SEX".to_string(),
        all_entries()
            .iter()
            .map(|e| e.sex.to_string())
            .unique()
            .collect_vec(),
    );
    result.insert(
        "ENTITY".to_string(),
        all_entries()
            .iter()
            .map(|e| e.icd10.to_string())
            .unique()
            .collect_vec(),
    );
    Json::from(result).into_response()
}

async fn query_counties() -> Response {
    Json::from(DISTRICT_NAMES.clone()).into_response()
}

async fn api_search(filter: Query<Filter>) -> Response {
    #[derive(Serialize)]
    struct Statistics {
        name: String,
        value: f32,
    }

    let filtered_entries = all_entries()
        .into_iter()
        .filter(|e| filter.entity.trim().is_empty() || filter.entity.trim() == e.icd10)
        .filter(|e| {
            filter.diagnosis_year_min.trim().is_empty()
                || if let Ok(value) = u32::from_str(filter.diagnosis_year_min.trim()) {
                    e.diagnosis_year >= value
                } else {
                    false
                }
        })
        .filter(|e| {
            filter.diagnosis_year_max.trim().is_empty()
                || if let Ok(value) = u32::from_str(filter.diagnosis_year_max.trim()) {
                    e.diagnosis_year <= value
                } else {
                    false
                }
        })
        .filter(|e| {
            filter.birth_decade_min.trim().is_empty()
                || if let Ok(value) = u32::from_str(filter.birth_decade_min.trim()) {
                    e.birth_decade >= value
                } else {
                    false
                }
        })
        .filter(|e| {
            filter.birth_decade_max.trim().is_empty()
                || if let Ok(value) = u32::from_str(filter.birth_decade_max.trim()) {
                    e.birth_decade <= value
                } else {
                    false
                }
        })
        .filter(|e| filter.sex.trim().is_empty() || filter.sex.trim() == e.sex)
        .sorted_by_key(|e| e.ags.to_string())
        .chunk_by(|e| e.ags[0..5].to_string())
        .into_iter()
        .map(|group| Statistics {
            name: group.0.to_string(),
            value: if filter.absolute == "true" {
                group.1.map(|e| e.count).sum::<u32>() as f32
            } else {
                let pat_count = group.1.map(|e| e.count).sum::<u32>() as f32;

                let pop = DISTRICT_POPULATIONS
                    .clone()
                    .into_iter()
                    .filter(|dp| dp.ags == group.0)
                    .map(|dp| dp.population)
                    .last()
                    .unwrap_or(0);

                pat_count * 100_000.0 / pop as f32
            },
        })
        .collect_vec();

    Json::from(filtered_entries).into_response()
}

async fn statistics(filter: Query<Filter>) -> Response {
    let filtered_entries = if filter.ags.is_empty() {
        all_entries()
    } else {
        all_entries()
            .into_iter()
            .filter(|e| e.ags == *filter.ags)
            .collect_vec()
    }
    .into_iter()
    .filter(|e| filter.entity.trim().is_empty() || filter.entity.trim() == e.icd10)
    .filter(|e| {
        filter.diagnosis_year_min.trim().is_empty()
            || if let Ok(value) = u32::from_str(filter.diagnosis_year_min.trim()) {
                e.diagnosis_year >= value
            } else {
                false
            }
    })
    .filter(|e| {
        filter.diagnosis_year_max.trim().is_empty()
            || if let Ok(value) = u32::from_str(filter.diagnosis_year_max.trim()) {
                e.diagnosis_year <= value
            } else {
                false
            }
    })
    .filter(|e| {
        filter.birth_decade_min.trim().is_empty()
            || if let Ok(value) = u32::from_str(filter.birth_decade_min.trim()) {
                e.birth_decade >= value
            } else {
                false
            }
    })
    .filter(|e| {
        filter.birth_decade_max.trim().is_empty()
            || if let Ok(value) = u32::from_str(filter.birth_decade_max.trim()) {
                e.birth_decade <= value
            } else {
                false
            }
    })
    .filter(|e| filter.sex.trim().is_empty() || filter.sex.trim() == e.sex)
    .collect_vec();

    Json::from(get_statistics(&filtered_entries)).into_response()
}

async fn index() -> IndexTemplate {
    IndexTemplate {}
}

async fn serve_asset(path: Option<Path<String>>) -> impl IntoResponse {
    match path {
        Some(path) => match ASSETS.get_file(path.to_string()) {
            Some(file) => Response::builder()
                .status(StatusCode::OK)
                .body(Body::from(file.contents())),
            None => Response::builder()
                .status(404)
                .body(Body::from("".as_bytes())),
        },
        None => Response::builder()
            .status(400)
            .body(Body::from("".as_bytes())),
    }
    .unwrap()
}

#[tokio::main]
async fn main() {
    #[cfg(debug_assertions)]
    {
        tracing_subscriber::fmt()
            .with_max_level(tracing::Level::DEBUG)
            .init();
    }

    let cache: Cache<String, Vec<Entry>> = Cache::builder()
        .max_capacity(1000)
        .time_to_live(Duration::from_secs(30 * 60))
        .time_to_idle(Duration::from_secs(5 * 60))
        .build();

    let app = Router::new()
        .route("/", get(index))
        .route("/config", get(query_config))
        .route("/data", get(api_search))
        .route("/districts", get(query_counties))
        .route("/statistics", get(statistics))
        .route(
            "/assets/*path",
            get(|path| async { serve_asset(path).await }),
        )
        .with_state(cache);

    #[cfg(debug_assertions)]
    let app = app.layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind("[::]:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap()
}
