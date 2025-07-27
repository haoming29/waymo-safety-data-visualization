// ==============================
// main.js
// ==============================

// Utility: format OPS_DEPOT strings into Title Case with spaces
function formatLocation(loc) {
  return loc
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// ==============================
// 1) DATA LOAD & PROCESS UTILS
// ==============================

/**
 * Load and merge the RO-miles and collision data.
 * Returns a Promise resolving to an array of {location, miles, collisions, ratio}.
 */
async function loadCollisionVsMilesData() {
  const [milesData, sgoData] = await Promise.all([
    d3.csv('data/ro_miles_per_location.csv', d3.autoType),
    d3.csv('data/sgo_crashes.csv', d3.autoType),
  ]);

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
      ratio: collisions / miles, // collisions per million miles
    };
  });
}

// ==============================
// 2) RENDER FUNCTION
// ==============================

/**
 * Renders Scene 1: Collisions vs. RO Miles scatterplot.
 * Circle radius encodes collisions/mile ratio; labels sit below.
 * @param {Object[]} data     => [{location, miles, collisions, ratio}, ...]
 * @param {string}   selector => DOM selector for chart container
 * @param {Object}   [cfg]    => optional config overrides
 */
function renderCollisionVsMilesScene(data, selector, cfg = {}) {
  const margin = cfg.margin || { top: 10, right: 20, bottom: 80, left: 80 };
  const width = (cfg.width || 800) - margin.left - margin.right;
  const height = (cfg.height || 600) - margin.top - margin.bottom;
  const color = cfg.pointColor || '#4285F4';

  // clear & prep container
  const container = d3.select(selector);
  container.selectAll('*').remove();

  // tooltip
  const tooltip = container
    .append('div')
    .attr('class', 'tooltip')
    .style('position', 'absolute')
    .style('z-index', '10')
    .style('background', 'rgba(255,255,255,0.9)')
    .style('padding', '6px 8px')
    .style('border', '1px solid #ccc')
    .style('border-radius', '4px')
    .style('pointer-events', 'none')
    .style('font-size', '14px')
    .style('opacity', 0);

  // SVG
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

  // X axis and label
  const xAxisG = svg
    .append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(6, '~s'));
  xAxisG.selectAll('text').style('font-size', '12px');
  xAxisG
    .append('text')
    .attr('class', 'axis-label')
    .attr('x', width / 2)
    .attr('y', 50) // separation from ticks
    .attr('fill', '#666') // lighter color
    .attr('opacity', 0.7)
    .attr('font-weight', 'normal')
    .attr('text-anchor', 'middle')
    .text('RO Miles (Millions, log scale)');

  // Y axis and label
  const yAxisG = svg.append('g').call(d3.axisLeft(y).ticks(6));
  yAxisG.selectAll('text').style('font-size', '12px');
  yAxisG
    .append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -50) // separation from ticks
    .attr('fill', '#666') // lighter color
    .attr('opacity', 0.7)
    .attr('font-weight', 'normal')
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
    .on('mouseover', (event, d) => {
      tooltip.style('opacity', 1).html(
        `<strong>${formatLocation(d.location)}</strong><br/>
             RO Miles: ${d3.format(',.3f')(d.miles)} M<br/>
             Collisions: ${d.collisions}<br/>
             Rate: <strong>${d3.format('.2f')(d.ratio)}</strong> per M miles`
      );
    })
    .on('mousemove', (event) => {
      tooltip
        .style('left', `${event.pageX + 10}px`)
        .style('top', `${event.pageY - 30}px`);
    })
    .on('mouseout', () => tooltip.style('opacity', 0));

  // labels below circles
  svg
    .selectAll('text.label')
    .data(data)
    .join('text')
    .classed('label', true)
    .attr('x', (d) => x(d.miles))
    .attr('y', (d) => y(d.collisions) + rScale(d.ratio) + 14)
    .attr('text-anchor', 'middle')
    .text((d) => formatLocation(d.location));
}

// ==============================
// 3) SCENE MANAGER
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

// initial render
sceneManager.show('collisionVsMiles', { selector: '#chart' });
