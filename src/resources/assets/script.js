function updateMap() {
    let url = document.location.origin + document.location.pathname;

    let absolut = document.getElementById('mode').value === 'absolut'
    let sex = document.getElementById('sex').value;
    let bf = document.getElementById('bf').value;
    let bt = document.getElementById('bt').value;
    let en = document.getElementById('en').value;
    let df = document.getElementById('df').value;
    let dt = document.getElementById('dt').value;

    if (bf > bt-9) {
        document.getElementById('bf').value = bt-9;
        bf = bt-9;
    }
    document.getElementById('bf-value').innerText = bf;
    document.getElementById('bt-value').innerText = bt;

    if (df > dt) {
        document.getElementById('df').value = dt;
        df = dt;
    }
    document.getElementById('df-value').innerText = df;
    document.getElementById('dt-value').innerText = dt;

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

        let name_map = res[1].value;

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
                min: data.length > 0
                    ? (Math.min.apply(Math, data.map(e => e.value)) > 0 ? Math.min.apply(Math, data.map(e => e.value)) : 0)
                    : 0,
                max: data.length > 0
                    ? (Math.max.apply(Math, data.map(e => e.value)))
                    : Number.MAX_VALUE,
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
                //orient: 'vertical',
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
                        }
                    },
                    select: false,
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
}