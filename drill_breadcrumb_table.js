looker.plugins.visualizations.add({
  // 1. Create the container and define the styles
  create: function(element, config) {
    element.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap');
        .viz-wrapper {
          font-family: 'Open Sans', sans-serif;
          padding: 15px;
          color: #333;
        }
        .breadcrumb-container {
          margin-bottom: 20px;
          font-size: 14px;
        }
        .step-text { color: #4285F4; font-weight: 600; }
        .separator { color: #999; margin: 0 8px; }
        .current-viz-text { color: #000; font-weight: 700; }

        .viz-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .viz-table th {
          text-align: left;
          font-size: 11px;
          text-transform: uppercase;
          color: #707781;
          border-bottom: 1px solid #EAEAEA;
          padding-bottom: 8px;
        }
        .viz-table td { padding: 12px 0; border-bottom: 1px solid #F8F8F8; vertical-align: middle; }

        /* The label (e.g., Furniture) */
        .category-label {
          cursor: pointer;
          color: #262D33;
          font-size: 13px;
          width: 30%;
          text-decoration: none;
        }
        .category-label:hover { text-decoration: underline; color: #4285F4; }

        /* The Pink Bar */
        .bar-area { width: 70%; display: flex; align-items: center; }
        .bar-bg { background: #F0F0F0; flex-grow: 1; height: 22px; cursor: pointer; position: relative; }
        .bar-fill { background: #E52592; height: 100%; transition: width 0.5s ease; }
        .bar-value { margin-left: 10px; font-size: 12px; color: #333; width: 60px; text-align: left; }
      </style>
      <div class="viz-wrapper">
        <div class="breadcrumb-container">
          <span class="step-text">Step 1</span>
          <span class="separator">></span>
          <span class="current-viz-text">Current Viz</span>
        </div>
        <table class="viz-table">
          <thead>
            <tr id="header-row"></tr>
          </thead>
          <tbody id="viz-body"></tbody>
        </table>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const body = document.getElementById('viz-body');
    const header = document.getElementById('header-row');
    body.innerHTML = "";
    header.innerHTML = "";

    // Identify the dimension (e.g. Category) and measure (e.g. Sales)
    const dim = queryResponse.fields.dimension_like[0];
    const meas = queryResponse.fields.measure_like[0];

    if (!dim || !meas) {
      element.innerHTML = "Error: Please select one dimension and one measure.";
      return done();
    }

    // Set Column Headers
    header.innerHTML = `<th>${dim.label_short}</th><th>${meas.label_short}</th>`;

    // Calculate Max Value for bar scaling
    const maxValue = Math.max(...data.map(row => row[meas.name].value));

    // Build the rows
    data.forEach(row => {
      const tr = document.createElement('tr');

      // 1. DIMENSION CELL (Label)
      const tdLabel = document.createElement('td');
      tdLabel.className = 'category-label';
      tdLabel.innerText = row[dim.name].value;
      
      // TRIGGER THE POPUP DRILL MENU HERE
      tdLabel.onclick = (event) => {
        LookerCharts.Utils.openDrillMenu({
          links: row[dim.name].links, // Pulls the 'drill_fields' from your LookML
          event: event
        });
      };
      tr.appendChild(tdLabel);

      // 2. MEASURE CELL (Pink Bar)
      const tdBar = document.createElement('td');
      const val = row[meas.name].value;
      const pct = (val / maxValue) * 100;

      tdBar.innerHTML = `
        <div class="bar-area">
          <div class="bar-bg">
            <div class="bar-fill" style="width: ${pct}%"></div>
          </div>
          <span class="bar-value">${val.toLocaleString()}</span>
        </div>
      `;

      // Make the Bar also trigger the popup menu
      tdBar.onclick = (event) => {
        LookerCharts.Utils.openDrillMenu({
          links: row[dim.name].links,
          event: event
        });
      };

      tr.appendChild(tdBar);
      body.appendChild(tr);
    });

    done();
  }
});
