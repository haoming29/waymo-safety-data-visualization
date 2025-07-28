// main.js

// ==============================
// 0) DATA CACHING & URL PARAMS
// ==============================
let dataCache = null;
async function loadData() {
  if (!dataCache) {
    const [milesData, sgoData] = await Promise.all([
      d3.csv('data/ro_miles_per_location.csv', d3.autoType),
      d3.csv('data/sgo_crashes.csv', d3.autoType),
    ]);
    dataCache = { milesData, sgoData };
  }
  return dataCache;
}

// Parse URL parameters
const urlParams = new URLSearchParams(window.location.search);
const initialScene = urlParams.get('scene') || 'collisionVsMiles';
const initialLocationParam = urlParams.get('location');

// ==============================
// UTILITIES
// ==============================
function formatLocation(loc) {
  return loc
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// ==============================
// 1) DATA PROCESSING
// ==============================
async function loadCollisionVsMilesData() {
  const { milesData, sgoData } = await loadData();
  const collisionMap = d3.rollup(
    sgoData,
    (v) => v.length,
    (d) => d.Location
  );
  return milesData.map((d) => {
    const collisions = collisionMap.get(d['Ops Depot']) || 0;
    const miles = d['Waymo RO Miles (Millions)'];
    return {
      location: d['Ops Depot'],
      miles,
      collisions,
      ratio: collisions / miles,
    };
  });
}

async function loadCollisionByTypeData() {
  const { sgoData } = await loadData();
  return sgoData;
}

// ==============================
// 2) SCENE 1 RENDER
// ==============================
function renderCollisionVsMilesScene(data, selector, cfg = {}) {
  const margin = cfg.margin || { top: 10, right: 20, bottom: 80, left: 80 };
  const width = (cfg.width || 800) - margin.left - margin.right;
  const height = (cfg.height || 600) - margin.top - margin.bottom;
  const color = cfg.pointColor || '#4285F4';

  const container = d3.select(selector);
  container.selectAll('*').remove();

  // tooltip
  const tooltip = container
    .append('div')
    .attr('class', 'tooltip')
    .style('position', 'absolute')
    .style('pointer-events', 'none')
    .style('background', 'rgba(255,255,255,0.9)')
    .style('padding', '6px 8px')
    .style('border', '1px solid #ccc')
    .style('border-radius', '4px')
    .style('font-size', '14px')
    .style('opacity', 0);

  // SVG setup
  const svg = container
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // scales
  const x = d3
    .scaleLog()
    .domain([
      d3.min(data, (d) => d.miles) * 0.8,
      d3.max(data, (d) => d.miles) * 1.2,
    ])
    .range([0, width]);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.collisions) * 1.1])
    .range([height, 0]);
  const rScale = d3
    .scaleSqrt()
    .domain(d3.extent(data, (d) => d.ratio))
    .range([4, 24]);

  // axes
  svg
    .append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(6, '~s'))
    .append('text')
    .attr('class', 'axis-label')
    .attr('x', width / 2)
    .attr('y', 50)
    .attr('fill', '#666')
    .attr('text-anchor', 'middle')
    .text('RO Miles (Millions, log scale)');

  svg
    .append('g')
    .call(d3.axisLeft(y).ticks(6))
    .append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -50)
    .attr('fill', '#666')
    .attr('text-anchor', 'middle')
    .text('Collision Count');

  // points
  svg
    .selectAll('circle')
    .data(data)
    .join('circle')
    .attr('cx', (d) => x(d.miles))
    .attr('cy', (d) => y(d.collisions))
    .attr('r', (d) => rScale(d.ratio))
    .attr('fill', color)
    .attr('opacity', 0.7)
    .style('cursor', 'pointer')
    .on('mouseover', (event, d) => {
      tooltip
        .style('opacity', 1)
        .html(
          `<strong>${formatLocation(
            d.location
          )}</strong><br/>RO Miles: ${d3.format(',.3f')(
            d.miles
          )} M<br/>Collisions: ${d.collisions}<br/>Rate: <strong>${d3.format(
            '.2f'
          )(d.ratio)}</strong> per M miles`
        );
    })
    .on('mousemove', (event) => {
      tooltip
        .style('left', `${event.pageX + 10}px`)
        .style('top', `${event.pageY - 30}px`);
    })
    .on('mouseout', () => tooltip.style('opacity', 0))
    .on('click', (event, d) => {
      const loc = d.location;
      window.history.pushState(
        {},
        '',
        `?scene=collisionsByType&location=${loc}`
      );
      document
        .querySelectorAll('.site-header nav a')
        .forEach((a) => a.classList.remove('active'));
      const link = document.querySelector('[data-scene="collisionsByType"]');
      link.classList.add('active');
      const info = sceneInfo.collisionsByType;
      document.querySelector('.scene-header h2').textContent = info.title;
      document.querySelector('.scene-header p').textContent = info.description;
      sceneManager.show('collisionsByType', {
        selector: '#chart',
        config: { initialLocation: loc },
      });
    });

  // labels
  svg
    .selectAll('text.label')
    .data(data)
    .join('text')
    .attr('class', 'label')
    .attr('x', (d) => x(d.miles))
    .attr('y', (d) => y(d.collisions) + rScale(d.ratio) + 14)
    .attr('text-anchor', 'middle')
    .text((d) => formatLocation(d.location));
}

// ==============================
// 3) SCENE 2 RENDER
// ==============================
function renderCollisionsByTypeScene(rawData, selector, cfg = {}) {
  const margin = cfg.margin || { top: 10, right: 20, bottom: 100, left: 80 };
  const width = (cfg.width || 800) - margin.left - margin.right;
  const height = (cfg.height || 600) - margin.top - margin.bottom;
  const defaultColor = cfg.barColor || '#28A745';

  const container = d3.select(selector);
  container.selectAll('*').remove();

  const locations = Array.from(new Set(rawData.map((d) => d.Location))).sort();
  let types = Array.from(new Set(rawData.map((d) => d['Crash Type'])));

  const colorScale = d3
    .scaleOrdinal()
    .domain(locations)
    .range(d3.schemeCategory10);

  // controls
  const controls = container
    .append('div')
    .attr('class', 'controls')
    .style('display', 'flex')
    .style('flex-direction', 'column')
    .style('margin', '1rem');

  controls
    .append('div')
    .style('font-weight', 'bold')
    .style('margin-bottom', '0.5rem')
    .text('Select Locations:');

  // All Locations checkbox
  const allLbl = controls.append('label').style('margin-bottom', '0.25rem');
  allLbl
    .append('input')
    .attr('type', 'checkbox')
    .attr('id', 'all-checkbox')
    .property('checked', true);
  allLbl.append('span').text(' All Locations');

  // individual checkboxes
  locations.forEach((loc) => {
    const lbl = controls.append('label').style('margin-bottom', '0.25rem');
    lbl
      .append('span')
      .style('display', 'inline-block')
      .style('width', '12px')
      .style('height', '12px')
      .style('background', colorScale(loc))
      .style('margin-right', '6px');
    lbl
      .append('input')
      .attr('type', 'checkbox')
      .attr('class', 'location-checkbox')
      .attr('value', loc);
    lbl.append('span').text(` ${formatLocation(loc)}`);
  });

  // tooltip
  const tooltip = container
    .append('div')
    .attr('class', 'tooltip')
    .style('position', 'absolute')
    .style('pointer-events', 'none')
    .style('background', 'rgba(255,255,255,0.9)')
    .style('padding', '6px 8px')
    .style('border', '1px solid #ccc')
    .style('border-radius', '4px')
    .style('font-size', '14px')
    .style('opacity', 0);

  // initial selection from URL
  if (cfg.initialLocation) {
    controls.select('#all-checkbox').property('checked', false);
    controls
      .selectAll('input.location-checkbox')
      .property('checked', function () {
        return this.value === cfg.initialLocation;
      });
  }

  // exclusivity handlers
  controls.select('#all-checkbox').on('change', function () {
    if (this.checked)
      controls.selectAll('input.location-checkbox').property('checked', false);
    updateChart();
  });
  controls.selectAll('input.location-checkbox').on('change', function () {
    controls.select('#all-checkbox').property('checked', false);
    updateChart();
  });

  function updateChart() {
    const allChecked = controls.select('#all-checkbox').property('checked');
    let selectedLocs = allChecked
      ? locations.slice()
      : controls
          .selectAll('input.location-checkbox:checked')
          .nodes()
          .map((n) => n.value);
    if (!allChecked && selectedLocs.length === 0)
      selectedLocs = locations.slice();

    // reorder types by descending total counts
    types.sort((a, b) => {
      const sa = selectedLocs.reduce(
        (s, loc) =>
          s +
          rawData.filter((d) => d.Location === loc && d['Crash Type'] === a)
            .length,
        0
      );
      const sb = selectedLocs.reduce(
        (s, loc) =>
          s +
          rawData.filter((d) => d.Location === loc && d['Crash Type'] === b)
            .length,
        0
      );
      return sb - sa;
    });

    const isBar = allChecked || selectedLocs.length === 1;

    container.selectAll('svg').remove();
    const svg = container
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    if (isBar) {
      const counts = types.map((t) => ({
        type: t,
        count: rawData.filter(
          (d) => selectedLocs.includes(d.Location) && d['Crash Type'] === t
        ).length,
      }));
      const fillColor =
        selectedLocs.length === 1 ? colorScale(selectedLocs[0]) : defaultColor;

      const x = d3.scaleBand().domain(types).range([0, width]).padding(0.2);
      const y = d3
        .scaleLinear()
        .domain([0, d3.max(counts, (d) => d.count) * 1.1])
        .range([height, 0]);

      svg
        .append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('transform', 'rotate(-30)')
        .attr('text-anchor', 'end');

      svg.append('g').call(d3.axisLeft(y).ticks(6));

      svg
        .selectAll('rect')
        .data(counts)
        .join('rect')
        .attr('x', (d) => x(d.type))
        .attr('y', (d) => y(d.count))
        .attr('width', x.bandwidth())
        .attr('height', (d) => height - y(d.count))
        .attr('fill', fillColor)
        .on('mouseover', (e, d) => {
          tooltip
            .style('opacity', 1)
            .html(`<strong>${d.type}</strong><br/>Count: ${d.count}`);
        })
        .on('mousemove', (e) => {
          tooltip
            .style('left', `${e.pageX + 10}px`)
            .style('top', `${e.pageY - 30}px`);
        })
        .on('mouseout', () => tooltip.style('opacity', 0));
    } else {
      const stackData = types.map((t) => {
        const row = { type: t };
        selectedLocs.forEach((loc) => {
          row[loc] = rawData.filter(
            (d) => d.Location === loc && d['Crash Type'] === t
          ).length;
        });
        return row;
      });
      const series = d3.stack().keys(selectedLocs)(stackData);

      const x = d3.scaleBand().domain(types).range([0, width]).padding(0.2);
      const y = d3
        .scaleLinear()
        .domain([
          0,
          d3.max(stackData, (d) =>
            selectedLocs.reduce((s, loc) => s + d[loc], 0)
          ) * 1.1,
        ])
        .range([height, 0]);

      svg
        .append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('transform', 'rotate(-30)')
        .attr('text-anchor', 'end');

      svg.append('g').call(d3.axisLeft(y).ticks(6));

      svg
        .selectAll('g.layer')
        .data(series)
        .join('g')
        .attr('class', 'layer')
        .attr('fill', (d) => colorScale(d.key))
        .selectAll('rect')
        .data((d) => d.map((p) => ({ ...p, key: d.key })))
        .join('rect')
        .attr('x', (d) => x(d.data.type))
        .attr('y', (d) => y(d[1]))
        .attr('height', (d) => y(d[0]) - y(d[1]))
        .attr('width', x.bandwidth())
        .on('mouseover', (e, d) => {
          tooltip
            .style('opacity', 1)
            .html(
              `<strong>${d.data.type}</strong><br/>${formatLocation(d.key)}: ${
                d.data[d.key]
              }`
            );
        })
        .on('mousemove', (e) => {
          tooltip
            .style('left', `${e.pageX + 10}px`)
            .style('top', `${e.pageY - 30}px`);
        })
        .on('mouseout', () => tooltip.style('opacity', 0));
    }

    // axis labels
    svg
      .append('text')
      .attr('class', 'axis-label')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#666')
      .text('Crash Type');

    svg
      .append('text')
      .attr('class', 'axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -margin.left + 20)
      .attr('text-anchor', 'middle')
      .attr('fill', '#666')
      .text('Collision Count');
  }

  updateChart();
}

// ==============================
// 4) SCENE MANAGER
// ==============================
const sceneManager = {
  _scenes: {},
  register(name, loader) {
    this._scenes[name] = loader;
  },
  async show(name, params) {
    if (!this._scenes[name]) return;
    await this._scenes[name](params);
  },
};

sceneManager.register(
  'collisionVsMiles',
  async ({ selector = '#chart', config } = {}) => {
    const data = await loadCollisionVsMilesData();
    renderCollisionVsMilesScene(data, selector, config);
  }
);
sceneManager.register(
  'collisionsByType',
  async ({ selector = '#chart', config } = {}) => {
    const raw = await loadCollisionByTypeData();
    renderCollisionsByTypeScene(raw, selector, config);
  }
);

// initial render based on URL
sceneManager.show(initialScene, {
  selector: '#chart',
  config: { initialLocation: initialLocationParam },
});
