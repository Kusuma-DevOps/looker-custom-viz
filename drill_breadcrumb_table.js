looker.plugins.visualizations.add({
  create: function(element, config) {
    element.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap');
        .viz-container { font-family: 'Open Sans', sans-serif; padding: 10px; }
        .breadcrumbs { margin-bottom: 15px; font-size: 14px; }
        .step { color: #4285f4; font-weight: bold; cursor: pointer; }
        .current { color: #000; font-weight: bold; margin-left: 5px; }
        .viz-table { width: 100%; border-collapse: collapse; }
        .viz-table th { text-align: left; font-size: 12px; color: #707781; border-bottom: 1px solid #EAEAEA; padding: 8px; }
        .viz-table td { padding: 10px 8px; border-bottom: 1px solid #F5F5F5; font-size: 13px; vertical-align: middle; }
        .drillable-link { color: #262D33; cursor: pointer; text-decoration: none; }
        .drillable-link:hover { text-decoration: underline; color: #4285f4; }
        .bar-container { display: flex; align-items: center; width: 100%; }
        .bar-bg { background: #f0f0f0; flex-grow: 1; height: 20px; position: relative; cursor: pointer; }
        .bar-fill { background: #E52592; height: 100%; transition: width 0.4s ease; }
        .bar-val { margin-left: 10px; font-size: 11px; color: #666; width: 60px; }
      </style>
      <div class="viz-container">
        <div class="breadcrumbs"><span class="step">Step 1</span> <span style="color:#999">></span> <span class="current">Current Viz</span></div>
        <table class="viz-table">
          <thead><tr id="h-row"></tr></thead>
          <tbody id="v-body"></tbody>
        </table>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const vBody = document.getElementById('v-body');
    const hRow = document.getElementById('h-row');
    vBody.innerHTML = "";
    hRow.innerHTML = "";

    const dim = queryResponse.fields.dimension_like[0];
    const meas = queryResponse.fields.measure_like[0];

    if (!dim || !meas) { return done(); }

    hRow.innerHTML = `<th>${dim.label_short}</th><th>${meas.label_short}</th>`;
    const maxVal = Math.max(...data.map(row => row[meas.name].value));

    data.forEach(row => {
      const tr = document.createElement('tr');

      // 1. Dimension Cell (The Label like 'Furniture')
      const tdLabel = document.createElement('td');
      tdLabel.className = 'drillable-link';
      tdLabel.innerText = row[dim.name].value;

      // --- THIS BLOCK TRIGGERS THE POPUP MENU (0:04 in video) ---
      tdLabel.onclick = (event) => {
        event.preventDefault(); // Stops the big modal from opening
        event.stopPropagation();
        LookerCharts.Utils.openDrillMenu({
          links: row[dim.name].links, 
          event: event
        });
      };
      tr.appendChild(tdLabel);

      // 2. Measure Cell (The Pink Bar)
      const tdBar = document.createElement('td');
      const val = row[meas.name].value;
      const pct = (val / maxVal) * 100;
      tdBar.innerHTML = `
        <div class="bar-container">
          <div class="bar-bg"><div class="bar-fill" style="width: ${pct}%"></div></div>
          <span class="bar-val">${val.toLocaleString()}</span>
        </div>
      `;

      // Make the bar also trigger the same popup menu
      tdBar.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        LookerCharts.Utils.openDrillMenu({
          links: row[dim.name].links,
          event: event
        });
      };

      tr.appendChild(tdBar);
      vBody.appendChild(tr);
    });

    done();
  }
});
