looker.plugins.visualizations.add({
  // Initial setup of the visualization container
  create: function(element, config) {
    element.style.fontFamily = ` -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif`;
    element.innerHTML = `
      <style>
        .viz-container { height: 100%; display: flex; flex-direction: column; padding: 10px; }
        .breadcrumbs { font-size: 14px; font-weight: bold; margin-bottom: 20px; color: #333; }
        .breadcrumbs span.active { color: #000; }
        .breadcrumbs a { color: #4285F4; text-decoration: none; cursor: pointer; }
        .viz-table { width: 100%; border-collapse: collapse; }
        .viz-table th { text-align: left; border-bottom: 1px solid #C1C6CC; padding: 8px; font-size: 12px; color: #707781; }
        .viz-table td { padding: 10px 8px; border-bottom: 1px solid #EAEAEA; font-size: 13px; }
        .bar-container { background: #f2f2f2; width: 100%; height: 20px; position: relative; }
        .bar-fill { background: #E52592; height: 100%; transition: width 0.5s ease; cursor: pointer; }
        .bar-label { position: absolute; right: -40px; top: 0; font-size: 11px; color: #333; }
        .clickable-cell { color: #262D33; cursor: pointer; }
        .clickable-cell:hover { text-decoration: underline; background: #f9f9f9; }
      </style>
      <div class="viz-container">
        <div id="breadcrumb-nav" class="breadcrumbs">Current Viz</div>
        <table class="viz-table">
          <thead>
            <tr id="table-headers"></tr>
          </thead>
          <tbody id="table-body"></tbody>
        </table>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const tableBody = document.getElementById('table-body');
    const tableHeaders = document.getElementById('table-headers');
    const breadcrumbNav = document.getElementById('breadcrumb-nav');

    // 1. Clear previous content
    tableBody.innerHTML = "";
    tableHeaders.innerHTML = "";

    // 2. Handle Breadcrumbs (Simulated for this view)
    // In a real app, you'd track state, but here we match the "Current Viz" UI
    breadcrumbNav.innerHTML = `Step 1 &nbsp; > &nbsp; <span class="active">Current Viz</span>`;

    // 3. Create Headers
    queryResponse.fields.dimension_like.forEach(dim => {
      tableHeaders.innerHTML += `<th>${dim.label_short || dim.label}</th>`;
    });
    queryResponse.fields.measure_like.forEach(meas => {
      tableHeaders.innerHTML += `<th>${meas.label_short || meas.label}</th>`;
    });

    // 4. Get max value for bar scaling
    const measureKey = queryResponse.fields.measure_like[0].name;
    const maxValue = Math.max(...data.map(row => row[measureKey].value));

    // 5. Render Rows
    data.forEach((row) => {
      const tr = document.createElement('tr');

      // Dimension Cell (Label)
      const dimKey = queryResponse.fields.dimension_like[0].name;
      const dimCell = document.createElement('td');
      dimCell.className = "clickable-cell";
      dimCell.innerText = row[dimKey].value;
      
      // --- IMPORTANT: This part creates the POPUP DRILL MENU ---
      dimCell.onclick = (event) => {
        LookerCharts.Utils.openDrillMenu({
          links: row[dimKey].links,
          event: event
        });
      };
      tr.appendChild(dimCell);

      // Measure Cell (The Pink Bar)
      const measCell = document.createElement('td');
      const val = row[measureKey].value;
      const pct = (val / maxValue) * 100;
      
      measCell.innerHTML = `
        <div class="bar-container">
          <div class="bar-fill" style="width: ${pct}%">
             <span class="bar-label">${val.toLocaleString()}</span>
          </div>
        </div>
      `;
      
      // Make the bar also trigger the drill menu
      measCell.onclick = (event) => {
        LookerCharts.Utils.openDrillMenu({
          links: row[dimKey].links,
          event: event
        });
      };

      tr.appendChild(measCell);
      tableBody.appendChild(tr);
    });

    done();
  }
});
