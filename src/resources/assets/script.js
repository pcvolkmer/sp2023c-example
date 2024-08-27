class InputStartEndRange extends HTMLElement {
    static observedAttributes = ['start', 'end'];

    constructor() {
        super();

        this._internals = this.attachInternals();

        this._internals.startMin = this.getAttribute('start-min') ? this.getAttribute('start-min') : 0;
        this._internals.startMax = this.getAttribute('start-max') ? this.getAttribute('start-max') : 10;
        this._internals.endMin = this.getAttribute('end-min') ? this.getAttribute('end-min') : 0;
        this._internals.endMax = this.getAttribute('end-max') ? this.getAttribute('end-max') : 10;

        this._internals.start = this.getAttribute('start') ? this.getAttribute('start') : this._internals.startMin;
        this._internals.end = this.getAttribute('end') ? this.getAttribute('end') : this._internals.endMax;

        this._internals.step = this.getAttribute('step') ? this.getAttribute('step') : 1;
    }

    get start() {
        return this._internals.start;
    }

    set start(value) {
        this._internals.start = value;
        this.shadowRoot.getElementById('start').value = value;
        this.updateTrack();
    }

    get end() {
        return this._internals.end;
    }

    set end(value) {
        this._internals.end = value;
        this.shadowRoot.getElementById('end').value = value;
        this.updateTrack();
    }

    connectedCallback() {
        let template = document.createElement('template');
        template.innerHTML = `<style>
                                .slide-wrapper {
                                    height: 3rem;
                                }
                                
                                .slide {
                                    display: flex;
                                    position: relative;
                                    width: 100%;
                                }
                                
                                .slide > input[type=range] {
                                    appearance: none;
                                    position: absolute;
                                    outline: none;
                                    background-color: transparent;
                                    pointer-events: none;
                                    margin: auto;
                                    height: 24px;
                                    width: 100%;
                                }
                                
                                .slide > input[type=range]::-moz-range-track {
                                    appearance: none;
                                    height: 4px;
                                }
                                
                                .slide > input[type=range]::-webkit-slider-runnable-track {
                                    appearance: none;
                                    height: 4px;
                                }
                                
                                .slide > input[type=range]::-moz-range-thumb {
                                    box-sizing: border-box;
                                    appearance: none;
                                    cursor: pointer;
                                    background-color: var(--blue);
                                    border: 2px solid white;
                                    border-radius: 50%;
                                    box-shadow: 0 1px 2px gray;
                                    pointer-events: auto;
                                    width: 20px;
                                    height: 20px;
                                }
                                
                                .slide > input[type=range]::-webkit-slider-thumb {
                                    box-sizing: border-box;
                                    appearance: none;
                                    cursor: pointer;
                                    background-color: var(--blue);
                                    border: 2px solid white;
                                    border-radius: 50%;
                                    box-shadow: 0 1px 2px gray;
                                    pointer-events: auto;
                                    width: 20px;
                                    height: 20px;
                                    margin-top: -7px;
                                }
                                
                                .slide-wrapper #track {
                                    width: 100%;
                                    height: 6px;
                                    position: absolute;
                                    background-color: #ccc;
                                    border-radius: 3px;
                                    margin: 10px auto;
                                }
                                
                                .slide-wrapper > .slide-value {
                                    font-size: smaller;
                                    display: block;
                                    position: relative;
                                    background-color: var(--blue);
                                    color: white;
                                    padding: 0.2rem .6rem;
                                    border-radius: 3px;
                                    text-align: center;
                                    margin: 1.8rem auto 0 auto;
                                    width: fit-content;
                                }
                                
                                .slide-wrapper > .slide-value::before {
                                    content: "";
                                    display: block;
                                    position: absolute;
                                    margin: 0 auto;
                                    background-color: var(--blue);
                                    width: 8px;
                                    height: 8px;
                                    rotate: 45deg;
                                    top: -4px;
                                    z-index: -10;
                                    left: 0;
                                    right: 0;
                                }
                            </style>
                            <div class="slide-wrapper">
                                <div class="slide">
                                    <div id="track"></div>
                                    <input id="start" type="range" min="${this._internals.startMin}" max="${this._internals.endMin}" value="${this._internals.start}" step="${this._internals.step}" />
                                    <input id="end" type="range" min="${this._internals.startMax}" max="${this._internals.endMax}" value="${this._internals.end}" step="${this._internals.step}" />
                                </div>
                                <span id="value" class="slide-value">2014 - 2024</span>
                            </div>`
        const shadowRoot = this.attachShadow({mode: 'open'});
        shadowRoot.appendChild(template.content.cloneNode(true));

        this.updateTrack();

        shadowRoot.getElementById('start').oninput = () => {
            let start = shadowRoot.getElementById('start');
            let end = shadowRoot.getElementById('end');
            if (parseInt(start.value) >= parseInt(end.value) - (this._internals.step-1)) {
                start.value = parseInt(end.value) - (this._internals.step-1);
            }
            this.updateTrack();
        };

        shadowRoot.getElementById('start').onchange = () => {
            this.dispatchEvent(new CustomEvent('change', { start: this._internals.start, end: this._internals.end }));
        };

        shadowRoot.getElementById('end').oninput = () => {
            let start = shadowRoot.getElementById('start');
            let end = shadowRoot.getElementById('end');

            if (parseInt(start.value) === parseInt(start.max)) {
                start.value = parseInt(end.value) - (this._internals.step-1);
            }

            if (parseInt(start.value) >= parseInt(end.value) - (this._internals.step-1)) {
                end.value = parseInt(start.value) + (this._internals.step-1);
            }

            this.updateTrack();
        };

        shadowRoot.getElementById('end').onchange = () => {
            this.dispatchEvent(new CustomEvent('change', { start: this._internals.start, end: this._internals.end }));
        };
    }

    updateTrack = () => {
        let startElem = this.shadowRoot.getElementById('start');
        let endElem = this.shadowRoot.getElementById('end');
        let trackElem = this.shadowRoot.getElementById('track');

        let start = (startElem.min - startElem.value) / (startElem.min - startElem.max) * 100;
        let end = (endElem.min - endElem.value) / (endElem.min - endElem.max) * 100;
        trackElem.style = `background: linear-gradient(to right, #ccc ${start}%, var(--blue) ${start}%, var(--blue) ${end}%, #ccc ${end}%)`;

        let valueElem = this.shadowRoot.getElementById('value');
        valueElem.innerText = `${startElem.value} - ${endElem.value}`;

        this._internals.start = startElem.value;
        this._internals.end = endElem.value;
    }
}

customElements.define('input-startend-range', InputStartEndRange);

document.getElementById('birthyear').addEventListener('change', (_) => { updateMap() });
document.getElementById('diagnosisyear').addEventListener('change', (_) => { updateMap() });

function resetMap() {
    document.getElementById('birthyear').start = '1900';
    document.getElementById('birthyear').end = '2009';
    document.getElementById('diagnosisyear').start = '2014';
    document.getElementById('diagnosisyear').end = '2024';
    setTimeout(updateMap, 250);
}

function updateMap() {
    let url = document.location.origin + document.location.pathname;

    let absolut = document.getElementById('mode').value === 'absolut'
    let sex = document.getElementById('sex').value;
    let bf = document.getElementById('birthyear').start;
    let bt = document.getElementById('birthyear').end;
    let en = document.getElementById('en').value;
    let df = document.getElementById('diagnosisyear').start;
    let dt = document.getElementById('diagnosisyear').end;

    Promise.allSettled([
        fetch(`${url}data?s=${sex}&bf=${bf}&bt=${bt}&en=${en}&df=${df}&dt=${dt}&absolut=${absolut}`, { headers: new Headers({ 'Accept': 'application/json' })})
            .then(res => res.json()),
        fetch(`${url}districts`, { headers: new Headers({ 'Accept': 'application/json' })})
            .then(res => res.json())
    ]).then(res => {
        if (res[0].status === 'rejected' || res[1].status === 'rejected') {
            return;
        }

        let chartElem = document.getElementById('chart');

        if (chartElem === null) {
            return;
        }

        let data = res[0].value.map(e => {
            if (e.name.startsWith("02") || e.name.startsWith("11")) {
                // HH, B
                return {name: e.name.substring(0, 2), value: e.value};
            } else {
                return {name: e.name, value: e.value};
            }
        });

        name_map = res[1].value;

        let max = data.length > 0
            ? Math.max.apply(Math, data.map(e => e.value))
            : Number.MAX_VALUE;

        let min = data.length > 0
            ? (Math.min.apply(Math, data.map(e => e.value)) < max ? Math.min.apply(Math, data.map(e => e.value)) : 0)
            : 0;

        let option = {
            tooltip: {
                trigger: 'item',
                formatter: (item) => {
                    if (item.data === undefined) return null;
                    return absolut === true
                        ? `${name_map[item.data.name]}</br>${item.data.value} (Patienten)`
                        : `${name_map[item.data.name]}</br>${item.data.value.toFixed(3)} (Inzidenz 100.000 Einwohner)`;
                }
            },
            visualMap: {
                show: true,
                min: min,
                max: max,
                inRange: {
                    color: [
                        '#6060f0',
                        '#60ffff',
                        '#74e400',
                        '#ffe000',
                        '#b00068']
                },
                calculable: false
            },
            toolbox: {
                show: true,
                left: 'left',
                top: 'top',
                feature: {
                    saveAsImage: {
                        name: "sp2023c-example"
                    }
                }
            },
            series: [
                {
                    name: 'Kreise',
                    type: 'map',
                    map: 'GEO',
                    // Merkatorprojektion
                    projection: {
                        project: (point) => [point[0] / 180 * Math.PI, -Math.log(Math.tan((Math.PI / 2 + point[1] / 180 * Math.PI) / 2))],
                        unproject: (point) => [point[0] * 180 / Math.PI, 2 * 180 / Math.PI * Math.atan(Math.exp(point[1])) - 90]
                    },
                    emphasis: {
                        label: {
                            show: false
                        },
                        itemStyle: {
                            areaColor: '#fff',
                            borderColor: '#f00',
                            borderWidth: 1
                        }
                    },
                    select: {
                        label: {
                            show: false
                        },
                        itemStyle: {
                            areaColor: '#fff',
                            borderColor: '#f00',
                            borderWidth: 1
                        }
                    },
                    label: {
                        show: false
                    },
                    data: data
                }
            ]
        };

        chartElem.className = '';
        chart.setOption(option);
    });

    updateStatistics();
}

function drawMap() {
    let chartElem = document.getElementById('chart');

    if (chartElem === null) {
        return;
    }

    chartElem.innerText = '';
    chartElem.className = 'loading';

    chart = echarts.init(chartElem);
    let url = document.location.origin + document.location.pathname;

    Promise.allSettled([
        fetch(`${url}assets/de_small.geojson`, { headers: new Headers({ 'Accept': 'application/json' })})
            .then(res => res.json()),
        fetch(`${url}config`, { headers: new Headers({ 'Accept': 'application/json' })})
            .then(res => res.json())
    ]).then(res => {
        if (res[0].status === 'rejected' || res[1].status === 'rejected') {
            return;
        }

        echarts.registerMap('GEO', res[0].value);
        updateMap();
    });

    chart.on('click', (params) => {
        if (params.data && name_map[params.data.name]) {
            selected_district = params.event.target.selected ? params.data.name : '';
            updateStatistics();
            return;
        }
        selected_district = '';
        updateStatistics();
    });
}

function drawStatistics() {
    let sex = document.getElementById('sex').value;
    let bf = document.getElementById('birthyear').start;
    let bt = document.getElementById('birthyear').end;
    let en = document.getElementById('en').value;
    let df = document.getElementById('diagnosisyear').start;
    let dt = document.getElementById('diagnosisyear').end;

    statistics_charts = [];
    selected_district = '';

    // Init charts
    Array.from(document.getElementById('statistics').children).forEach(elem => {
        let chartDom = document.getElementById(elem.id);

        switch (elem.id) {
            case 'st-sex':
                statistics_charts[elem.id] = {title: 'Geschlecht', chart: echarts.init(chartDom)};
                break;
            case 'st-birth':
                statistics_charts[elem.id] = {title: 'Jahrgang', chart: echarts.init(chartDom)};
                break;
            case 'st-entity':
                statistics_charts[elem.id] = {title: 'Entität', chart: echarts.init(chartDom)};
                break;
            case 'st-diagnosisyear':
                statistics_charts[elem.id] = {title: 'Diagnosejahr', chart: echarts.init(chartDom)};
                break;
        }
    });

    updateStatistics();
}

function updateStatistics() {
    // Update headline
    if (selected_district.length === 0) {
        document.getElementById('statistics-head').innerHTML = `<span>Statistiken</span>`;
    } else {
        document.getElementById('statistics-head').innerHTML = `<span>Statistiken für <strong>${name_map[selected_district]}</strong></span>`;
    }

    let url = document.location.origin + document.location.pathname;

    let sex = document.getElementById('sex').value;
    let bf = document.getElementById('birthyear').start;
    let bt = document.getElementById('birthyear').end;
    let en = document.getElementById('en').value;
    let df = document.getElementById('diagnosisyear').start;
    let dt = document.getElementById('diagnosisyear').end;

    fetch(`${url}statistics?s=${sex}&bf=${bf}&bt=${bt}&en=${en}&df=${df}&dt=${dt}&ags=${selected_district}`, {headers: new Headers({'Accept': 'application/json'})})
        .then(res => res.json())
        .then(data => {
            for (const key in data) {
                let itemData = data[key].sort((a,b) => b.value - a.value);

                // Move "Other" to end
                if (key === 'icd10') {
                    itemData = data[key].filter(e => e.name !== 'Other').sort((a,b) => b.value - a.value);
                    let other = data[key].filter(e => e.name === 'Other');
                    if (other.length === 1) {
                        itemData.push(other[0]);
                    }
                }

                let option = {
                    title: {
                        left: 'center'
                    },
                    tooltip: {
                        trigger: 'item'
                    },
                    series: [
                        {
                            type: 'pie',
                            radius: ['30%', '60%'],
                            label: {
                                show: false,
                            },
                            labelLine: {
                                show: false
                            },
                            emphasis: {
                                label: {
                                    show: false
                                }
                            },
                            data: itemData
                        }
                    ]
                };

                switch (key) {
                    case 'icd10':
                        option.title.text = 'Entität';
                        statistics_charts['st-entity'].chart.setOption(option);
                        break;
                    case 'diagnosis_year':
                        option.title.text = 'Diagnosedatum';
                        statistics_charts['st-diagnosisyear'].chart.setOption(option);
                        break;
                    case 'birth_decade':
                        option.title.text = 'Jahrgang';
                        statistics_charts['st-birth'].chart.setOption(option);
                        break;
                    case 'sex':
                        option.title.text = 'Geschlecht';
                        statistics_charts['st-sex'].chart.setOption(option);
                        break;
                }
            }
        });
}
