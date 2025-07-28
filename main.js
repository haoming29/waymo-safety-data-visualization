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
    .attr('class', 'tooltip-s1')
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
    .attr('class', 'tooltip-s2')
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
        .style('cursor', 'pointer')
        .on('mouseover', (e, d) => {
          tooltip
            .style('opacity', 1)
            .html(
              `<strong>${d.type}</strong><br/>Count: ${d.count}<br/><br/><em style="color: #666; font-size: 12px;">Click to see detail trend</em>`
            );
        })
        .on('mousemove', (e) => {
          tooltip
            .style('left', `${e.pageX + 10}px`)
            .style('top', `${e.pageY - 30}px`);
        })
        .on('mouseout', () => tooltip.style('opacity', 0))
        .on('click', (e, d) => {
          // Get the currently selected location (single location mode)
          const selectedLocation = selectedLocs[0]; // In single location mode, there's only one

          // Navigate to dimensionTrends scene with location
          const params = new URLSearchParams();
          params.set('scene', 'dimensionTrends');
          params.set('location', selectedLocation);
          params.set('fromScene', 'collisionsByType');
          window.history.pushState({}, '', `?${params.toString()}`);

          // Update navigation
          document
            .querySelectorAll('.site-header nav a')
            .forEach((a) => a.classList.remove('active'));
          const link = document.querySelector('[data-scene="dimensionTrends"]');
          link.classList.add('active');

          // Update header
          const info = sceneInfo.dimensionTrends;
          document.querySelector('.scene-header h2').textContent = info.title;
          document.querySelector('.scene-header p').textContent =
            info.description;

          // Show scene with config
          sceneManager.show('dimensionTrends', {
            selector: '#chart',
            config: {
              initialLocation: selectedLocation,
              initialDimension: 'crashType',
              fromScene: 'collisionsByType',
              fromLocation: selectedLocation,
            },
          });
        });
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
        .style('cursor', 'pointer')
        .on('mouseover', (e, d) => {
          tooltip
            .style('opacity', 1)
            .html(
              `<strong>${d.data.type}</strong><br/>${formatLocation(d.key)}: ${
                d.data[d.key]
              }<br/><br/><em style="color: #666; font-size: 12px;">Click to see detail trend</em>`
            );
        })
        .on('mousemove', (e) => {
          tooltip
            .style('left', `${e.pageX + 10}px`)
            .style('top', `${e.pageY - 30}px`);
        })
        .on('mouseout', () => tooltip.style('opacity', 0))
        .on('click', (e, d) => {
          // Get the location from the clicked bar
          const selectedLocation = d.key;

          // Navigate to dimensionTrends scene with location
          const params = new URLSearchParams();
          params.set('scene', 'dimensionTrends');
          params.set('location', selectedLocation);
          params.set('fromScene', 'collisionsByType');
          window.history.pushState({}, '', `?${params.toString()}`);

          // Update navigation
          document
            .querySelectorAll('.site-header nav a')
            .forEach((a) => a.classList.remove('active'));
          const link = document.querySelector('[data-scene="dimensionTrends"]');
          link.classList.add('active');

          // Update header
          const info = sceneInfo.dimensionTrends;
          document.querySelector('.scene-header h2').textContent = info.title;
          document.querySelector('.scene-header p').textContent =
            info.description;

          // Show scene with config
          sceneManager.show('dimensionTrends', {
            selector: '#chart',
            config: {
              initialLocation: selectedLocation,
              initialDimension: 'crashType',
              fromScene: 'collisionsByType',
              fromLocation: selectedLocation,
            },
          });
        });
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
// 5) SCENE 3 (Dimension Trends) DATA & RENDER LOGIC
// ==============================

// 5.1) DATA PROCESSING FOR DIMENSION TRENDS
// Aggregates collision counts by a chosen dimension and time granularity
async function loadDimensionTrendsData({ location, dimension, granularity }) {
  const { sgoData } = await loadData();
  const filtered = sgoData.filter((d) => d.Location === location);

  // Get global date range across all data (not just this location)
  const allTimeBuckets = Array.from(
    new Set(
      sgoData.map((d) => {
        const ym = d['Year Month'];
        return granularity === 'year' ? Math.floor(ym / 100) : ym;
      })
    )
  ).sort();

  // Find first collision data entry for this location (earliest Year Month)
  const locationData = sgoData.filter((d) => d.Location === location);
  const firstCollisionYearMonth =
    locationData.length > 0
      ? Math.min(...locationData.map((d) => d['Year Month']))
      : null;
  const firstCollisionDate = firstCollisionYearMonth
    ? granularity === 'year'
      ? new Date(Math.floor(firstCollisionYearMonth / 100), 0, 1)
      : new Date(
          Math.floor(firstCollisionYearMonth / 100),
          (firstCollisionYearMonth % 100) - 1,
          1
        )
    : null;

  let series;
  if (dimension === 'outcome') {
    const outcomes = [
      { key: 'Any Injury', field: 'Is Any-Injury-Reported' },
      { key: 'Airbag Deployment', field: 'Is Airbag Deployment' },
      {
        key: 'Suspected Serious Injury',
        field: 'Is Suspected Serious Injury+',
      },
    ];
    series = outcomes.map((o) => ({
      key: o.key,
      values: allTimeBuckets.map((tb) => {
        // Check if this location has any data for this time bucket
        const hasDataForPeriod = filtered.some((d) => {
          const bucket =
            granularity === 'year'
              ? Math.floor(d['Year Month'] / 100)
              : d['Year Month'];
          return bucket === tb;
        });

        const count = hasDataForPeriod
          ? filtered.filter((d) => {
              const bucket =
                granularity === 'year'
                  ? Math.floor(d['Year Month'] / 100)
                  : d['Year Month'];
              return (
                bucket === tb && (d[o.field] === true || d[o.field] === 'True')
              );
            }).length
          : null; // null means no data for this period

        const date =
          granularity === 'year'
            ? new Date(tb, 0, 1)
            : new Date(Math.floor(tb / 100), (tb % 100) - 1, 1);
        return { date, count, hasData: hasDataForPeriod };
      }),
    }));
  } else if (dimension === 'crashType') {
    const cats = Array.from(
      new Set(filtered.map((d) => d['Crash Type']))
    ).sort();
    series = cats.map((cat) => ({
      key: cat,
      values: allTimeBuckets.map((tb) => {
        // Check if this location has any data for this time bucket
        const hasDataForPeriod = filtered.some((d) => {
          const bucket =
            granularity === 'year'
              ? Math.floor(d['Year Month'] / 100)
              : d['Year Month'];
          return bucket === tb;
        });

        const count = hasDataForPeriod
          ? filtered.filter((d) => {
              const bucket =
                granularity === 'year'
                  ? Math.floor(d['Year Month'] / 100)
                  : d['Year Month'];
              return bucket === tb && d['Crash Type'] === cat;
            }).length
          : null;

        const date =
          granularity === 'year'
            ? new Date(tb, 0, 1)
            : new Date(Math.floor(tb / 100), (tb % 100) - 1, 1);
        return { date, count, hasData: hasDataForPeriod };
      }),
    }));
  } else {
    const fieldName = dimension;
    const cats = Array.from(
      new Set(filtered.map((d) => String(d[fieldName])))
    ).sort();
    series = cats.map((cat) => ({
      key: cat,
      values: allTimeBuckets.map((tb) => {
        // Check if this location has any data for this time bucket
        const hasDataForPeriod = filtered.some((d) => {
          const bucket =
            granularity === 'year'
              ? Math.floor(d['Year Month'] / 100)
              : d['Year Month'];
          return bucket === tb;
        });

        const count = hasDataForPeriod
          ? filtered.filter((d) => {
              const bucket =
                granularity === 'year'
                  ? Math.floor(d['Year Month'] / 100)
                  : d['Year Month'];
              return bucket === tb && String(d[fieldName]) === cat;
            }).length
          : null;

        const date =
          granularity === 'year'
            ? new Date(tb, 0, 1)
            : new Date(Math.floor(tb / 100), (tb % 100) - 1, 1);
        return { date, count, hasData: hasDataForPeriod };
      }),
    }));
  }

  return { series, timeBuckets: allTimeBuckets, firstCollisionDate };
}

async function renderDimensionTrendsScene({ selector, config }) {
  const container = d3.select(selector).style('position', 'relative');
  container.selectAll('*').remove();

  // preload data for controls
  const { sgoData } = await loadData();
  const locations = Array.from(new Set(sgoData.map((d) => d.Location))).sort();

  // layout: sidebar controls + chart area
  const layout = container.append('div').style('display', 'flex');

  const controls = layout
    .append('div')
    .style('display', 'flex')
    .style('flex-direction', 'column')
    .style('gap', '1rem')
    .style('width', '200px')
    .style('padding', '1rem')
    .style('box-sizing', 'border-box');

  // Add back button if coming from another scene
  if (config.fromScene) {
    const backButton = controls
      .append('button')
      .style('padding', '8px 12px')
      .style('background', '#007bff')
      .style('color', 'white')
      .style('border', 'none')
      .style('border-radius', '4px')
      .style('cursor', 'pointer')
      .style('font-size', '14px')
      .text('← Back to Collisions by Type')
      .on('click', () => {
        // Navigate back to collisionsByType scene with the same location
        const params = new URLSearchParams();
        params.set('scene', 'collisionsByType');
        params.set('location', config.fromLocation);
        window.history.pushState({}, '', `?${params.toString()}`);

        // Update navigation
        document
          .querySelectorAll('.site-header nav a')
          .forEach((a) => a.classList.remove('active'));
        const link = document.querySelector('[data-scene="collisionsByType"]');
        link.classList.add('active');

        // Update header
        const info = sceneInfo.collisionsByType;
        document.querySelector('.scene-header h2').textContent = info.title;
        document.querySelector('.scene-header p').textContent =
          info.description;

        // Show scene with config
        sceneManager.show('collisionsByType', {
          selector: '#chart',
          config: { initialLocation: config.fromLocation },
        });
      });

    // Add hover effects
    backButton
      .on('mouseover', function () {
        d3.select(this).style('background', '#0056b3');
      })
      .on('mouseout', function () {
        d3.select(this).style('background', '#007bff');
      });
  }

  const chartDiv = layout
    .append('div')
    .style('flex', '1')
    .style('position', 'relative');

  // Location selector
  controls.append('label').text('Location:');
  const locSel = controls.append('select');
  locSel
    .selectAll('option')
    .data(locations)
    .join('option')
    .attr('value', (d) => d)
    .text((d) => formatLocation(d));
  locSel.property('value', config.initialLocation || locations[0]);

  // Granularity selector
  controls.append('label').text('Granularity:');
  const granDiv = controls
    .append('div')
    .style('display', 'flex')
    .style('gap', '8px');
  ['month', 'year'].forEach((g) => {
    const lbl = granDiv
      .append('label')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('gap', '4px');
    lbl
      .append('input')
      .attr('type', 'radio')
      .attr('name', 'gran')
      .attr('value', g)
      .property('checked', g === (config.initialGranularity || 'month'));
    lbl.append('span').text(g.charAt(0).toUpperCase() + g.slice(1));
  });

  // Dimension selector
  controls.append('label').text('Dimension:');
  const dimSel = controls.append('select');
  dimSel
    .selectAll('option')
    .data(['outcome', 'crashType'])
    .join('option')
    .attr('value', (d) => d)
    .text((d) => (d === 'outcome' ? 'Outcome' : 'Crash Type'));
  dimSel.property('value', config.initialDimension || 'outcome');

  // Categories checklist
  controls.append('label').text('Categories:');
  const catDiv = controls
    .append('div')
    .style('flex', '1')
    .style('overflow-y', 'auto')
    .style('max-height', '200px')
    .style('border', '1px solid #ccc')
    .style('padding', '4px');

  // Tooltip element (unique class to avoid conflicts with other scenes)
  const tooltip = chartDiv
    .append('div')
    .attr('class', 'dimension-tooltip')
    .style('position', 'absolute')
    .style('pointer-events', 'none')
    .style('background', 'rgba(255,255,255,0.9)')
    .style('padding', '6px 8px')
    .style('border', '1px solid #ccc')
    .style('border-radius', '4px')
    .style('font-size', '14px')
    .style('opacity', 0);

  // Don't clear chartDiv here since tooltip is already created

  // SVG canvas
  const totalWidth = 1000;
  const totalHeight = 500;
  const margin = { top: 20, right: 150, bottom: 40, left: 60 };
  const width = totalWidth - margin.left - margin.right;
  const height = totalHeight - margin.top - margin.bottom;
  const svg = chartDiv
    .append('svg')
    .attr('width', totalWidth)
    .attr('height', totalHeight)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Remove collision type filtering - just use location filtering

  // Main update function that redraws everything
  async function update() {
    const loc = locSel.property('value');
    const dim = dimSel.property('value');
    const gran = granDiv.select('input[name="gran"]:checked').property('value');

    const { series, firstCollisionDate } = await loadDimensionTrendsData({
      location: loc,
      dimension: dim,
      granularity: gran,
    });

    // Define color scale
    const color = d3
      .scaleOrdinal()
      .domain(series.map((s) => s.key))
      .range(d3.schemeCategory10);

    // Preserve current selections before rebuilding
    const currentSelections = catDiv
      .selectAll('input:checked')
      .nodes()
      .map((n) => n.value);

    // Get all current category keys to detect if we're switching dimensions
    const currentCategoryKeys = catDiv
      .selectAll('input')
      .nodes()
      .map((n) => n.value);

    const newCategoryKeys = series.map((s) => s.key);

    // Check if any of the current categories match the new categories
    // If none match, we're switching dimensions and should select all by default
    const isDimensionSwitch =
      currentCategoryKeys.length > 0 &&
      !currentCategoryKeys.some((key) => newCategoryKeys.includes(key));

    // Clear and rebuild categories with total counts
    catDiv.selectAll('label').remove();
    series.forEach((s) => {
      const totalCount = s.values.reduce((sum, d) => sum + d.count, 0);

      const lbl = catDiv
        .append('label')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('margin-bottom', '4px')
        .style('cursor', 'pointer');

      // Check if this category was previously selected, or default to true for new categories or dimension switches
      const shouldBeChecked =
        isDimensionSwitch || currentSelections.length === 0
          ? true
          : currentSelections.includes(s.key);

      lbl
        .append('input')
        .attr('type', 'checkbox')
        .attr('value', s.key)
        .property('checked', shouldBeChecked)
        .on('change', updateChart); // Changed to call updateChart instead of update

      lbl
        .append('div')
        .style('width', '14px')
        .style('height', '14px')
        .style('background-color', color(s.key))
        .style('margin-left', '8px')
        .style('margin-right', '8px')
        .style('border-radius', '2px')
        .style('flex-shrink', '0');

      lbl.append('span').style('flex', '1').text(s.key);

      lbl
        .append('span')
        .style('font-size', '12px')
        .style('color', '#666')
        .style('margin-left', '8px')
        .text(`(${totalCount})`);
    });

    // Now update the chart with current selections
    updateChart();
  }

  // Separate function to update just the chart based on current category selections
  function updateChart() {
    const loc = locSel.property('value');
    const dim = dimSel.property('value');
    const gran = granDiv.select('input[name="gran"]:checked').property('value');

    // We need to get the current data again for the chart
    loadDimensionTrendsData({
      location: loc,
      dimension: dim,
      granularity: gran,
    }).then(({ series, firstCollisionDate }) => {
      // Define color scale
      const color = d3
        .scaleOrdinal()
        .domain(series.map((s) => s.key))
        .range(d3.schemeCategory10);

      // Get selected categories
      const selected = catDiv
        .selectAll('input:checked')
        .nodes()
        .map((n) => n.value);
      const dataSeries = series.filter((s) => selected.includes(s.key));

      if (dataSeries.length === 0) return;

      // Clear SVG and redraw
      svg.selectAll('*').remove();

      // scales
      const dates =
        dataSeries.length > 0 ? dataSeries[0].values.map((d) => d.date) : [];
      const x = d3.scaleTime().domain(d3.extent(dates)).range([0, width]);
      const y = d3
        .scaleLinear()
        .domain([
          0,
          d3.max(dataSeries.flatMap((s) => s.values.map((v) => v.count))),
        ])
        .nice()
        .range([height, 0]);

      // axes
      svg
        .append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(6));
      svg.append('g').call(d3.axisLeft(y).ticks(6));

      // Add X axis label
      svg
        .append('text')
        .attr('class', 'axis-label')
        .attr('x', width / 2)
        .attr('y', height + 35)
        .style('text-anchor', 'middle')
        .style('fill', '#666')
        .text(gran === 'year' ? 'Year' : 'Month');

      // Add Y axis label
      svg
        .append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -40)
        .style('text-anchor', 'middle')
        .style('fill', '#666')
        .text('Count');

      // Add first collision annotation if available
      if (firstCollisionDate) {
        const firstCollisionX = x(firstCollisionDate);

        // Only show annotation if the date is within the visible range
        if (firstCollisionX >= 0 && firstCollisionX <= width) {
          // Vertical line for first collision
          svg
            .append('line')
            .attr('class', 'first-collision-line')
            .attr('x1', firstCollisionX)
            .attr('x2', firstCollisionX)
            .attr('y1', 0)
            .attr('y2', height)
            .style('stroke', '#ff6b6b')
            .style('stroke-width', 2)
            .style('stroke-dasharray', '5,5')
            .style('opacity', 0.7);

          // Label for first collision
          svg
            .append('text')
            .attr('class', 'first-collision-label')
            .attr('x', firstCollisionX)
            .attr('y', -10)
            .style('text-anchor', 'middle')
            .style('fill', '#ff6b6b')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .text('First Collision');
        }
      }

      // lines (only for periods with data)
      const lineGen = d3
        .line()
        .defined((d) => d.hasData) // Only draw line segments where there's data
        .x((d) => x(d.date))
        .y((d) => y(d.count));

      svg
        .selectAll('.line')
        .data(dataSeries)
        .join('path')
        .attr('class', 'line')
        .attr('fill', 'none')
        .attr('stroke', (d) => color(d.key))
        .attr('stroke-width', 2)
        .attr('d', (d) => lineGen(d.values));

      // circles for data points (only for periods with data)
      dataSeries.forEach((s) => {
        const dataWithValues = s.values.filter((d) => d.hasData);
        svg
          .selectAll(`.dot-${s.key.replace(/\s+/g, '')}`)
          .data(dataWithValues)
          .join('circle')
          .attr('class', `dot-${s.key.replace(/\s+/g, '')}`)
          .attr('cx', (d) => x(d.date))
          .attr('cy', (d) => y(d.count))
          .attr('r', 4)
          .attr('fill', color(s.key));
      });

      // Create invisible overlay for mouse tracking
      const overlay = svg
        .append('rect')
        .attr('class', 'overlay')
        .attr('width', width)
        .attr('height', height)
        .style('fill', 'none')
        .style('pointer-events', 'all');

      // Vertical line for tooltip
      const verticalLine = svg
        .append('line')
        .attr('class', 'vertical-line')
        .style('stroke', '#666')
        .style('stroke-width', 1)
        .style('stroke-dasharray', '3,3')
        .style('opacity', 0);

      // Mouse events for vertical tooltip
      overlay
        .on('mouseover', () => {
          verticalLine.style('opacity', 1);
          tooltip.style('opacity', 1);
        })
        .on('mouseout', () => {
          verticalLine.style('opacity', 0);
          tooltip.style('opacity', 0);
        })
        .on('mousemove', (event) => {
          const [mouseX] = d3.pointer(event);
          const xDate = x.invert(mouseX);

          // Find closest date in data
          const bisectDate = d3.bisector((d) => d.date).left;
          let closestData = [];

          dataSeries.forEach((s) => {
            const i = bisectDate(s.values, xDate, 1);
            const d0 = s.values[i - 1];
            const d1 = s.values[i];
            const d = d1 && xDate - d0.date > d1.date - xDate ? d1 : d0;
            if (d && d.hasData) {
              // Only include data points that actually have data
              closestData.push({
                series: s.key,
                date: d.date,
                count: d.count,
                color: color(s.key),
              });
            }
          });

          if (closestData.length > 0) {
            const xPos = x(closestData[0].date);
            verticalLine
              .attr('x1', xPos)
              .attr('x2', xPos)
              .attr('y1', 0)
              .attr('y2', height);

            // Create tooltip content
            const tooltipContent = closestData
              .sort((a, b) => b.count - a.count)
              .map(
                (
                  d
                ) => `<div style="display: flex; align-items: center; margin-bottom: 4px;">
                <div style="width: 12px; height: 12px; background-color: ${d.color}; margin-right: 8px; border-radius: 2px;"></div>
                <strong>${d.series}:</strong> ${d.count}
              </div>`
              )
              .join('');

            const dateStr = d3.timeFormat(gran === 'year' ? '%Y' : '%Y-%m')(
              closestData[0].date
            );

            const [px, py] = d3.pointer(event, chartDiv.node());
            tooltip
              .html(
                `<div style="margin-bottom: 8px;"><strong>${dateStr}</strong></div>${tooltipContent}`
              )
              .style('left', `${px + margin.left + 10}px`)
              .style('top', `${py + margin.top - 150}px`);
          }
        });
    }); // Close the .then() block for loadDimensionTrendsData
  } // Close the updateChart function

  // attach controls
  locSel.on('change', update);
  granDiv.selectAll('input').on('change', update);
  dimSel.on('change', update);

  // initial draw
  update();
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
sceneManager.register(
  'dimensionTrends',
  async ({ selector = '#chart', config = {} } = {}) => {
    renderDimensionTrendsScene({ selector, config });
  }
);

// Show intro modal on page load
const introModal = document.getElementById('intro-modal');
const introClose = document.getElementById('intro-close');

// Display it
window.addEventListener('load', () => {
  introModal.style.display = 'flex';
});

// Close handler
introClose.addEventListener('click', () => {
  introModal.style.display = 'none';
});
