// 1) Load all four CSVs with their actual filenames:
Promise.all([
  d3.csv('data/ro_miles_per_location.csv', d3.autoType),
  d3.csv('data/sgo_crashes.csv', d3.autoType),
  d3.csv('data/collision_counts.csv', d3.autoType),
  d3.csv('data/miles_benchmark_dynamic.csv', d3.autoType),
])
  .then(([milesData, sgoData, countsData, dynamicData]) => {
    console.log({ milesData, sgoData, countsData, dynamicData });
    // 2) Kick off Scene 1 rendering:
    renderScene1(milesData, countsData, dynamicData);
  })
  .catch((err) => console.error('Error loading CSVs:', err));

// 3) Stub for Scene 1
function renderScene1(milesData, countsData, dynamicData) {
  // -- set up your SVG container and margin convention --
  const margin = { top: 40, right: 20, bottom: 40, left: 60 };
  const width = 800 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;
  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // -- TODO: compute contact rates per million miles by date (using countsData + dynamicData) --

  // -- TODO: set up scales (x = time, y = rate), axes, and two lines for Waymo vs. human benchmark --

  // -- TODO: add title, axes labels, and initial annotation call-out --
}
