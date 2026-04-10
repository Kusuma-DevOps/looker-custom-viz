looker.plugins.visualizations.add({
  // 1. Setup the basic containers
  create: function(element, config) {
    element.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600&display=swap');
        .custom-viz-container {
          font-family: 'Open Sans', sans-serif;
          padding: 20px;
          color: #333;
        }
        .breadcrumb-row {
          margin-bottom: 25px;
          font-size: 14px;
        }
        .step-link {
          color: #4285F4;
          text-decoration: none;
          font-weight: 600;
        }
        .current-viz {
          color: #000;
          font-weight: 700;
          margin-left: 8px;
        }
        .viz-table {
          width: 100%;
          border-collapse: collapse;
        }
        .viz-table th {
          text-align: left;
          font-size: 12px;
          text-transform: uppercase;
          color: #707781;
          border-bottom: 1px solid #EAEAEA;
          padding: 8px;
        }
        .viz-table td {
          padding: 12px 8px;
          border-bottom: 1px solid #F4F4F4;
          font-size: 13px;
        }
        .label-cell {
          cursor: pointer;
          color: #262D33;
          width: 30%;
        }
        .label-cell:hover {
          text-decoration: underline;
        }
        .bar-wrapper {
          display: flex;
          align-items: center;
          width: 70%;
        }
        .bar-background {
          background-color: #F0F0F0;
          height: 22px;
          flex-grow: 1;
          position: relative;
          cursor: pointer;
        }
        .bar-fill {
          background-color: #E52592; /* The Pink Color from your video */
          height: 100%;
          transition: width 0.4s ease-out;
        }
        .bar-value {
          margin-left: 10px;
          font-size: 12px;
          color: #333;
          min-width: 50px;
        }
      </style>
      <div class="custom-viz-container">
        <div class="breadcrumb-row" id="breadcrumbs">
           <a href="#" class="step-link">Step 1</a> 
           <span style="color: #999; margin: 0 5px;">&nbsp; | &nbsp;</span> 
           <span class="current-viz">Current Viz</span>
        </div>
        <table class="viz-table">
          <thead>
            <tr id="headers"></tr>
          </thead>
          <tbody id="rows-container"></tbody>
        </table>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const container = document.getElementById('rows-container');
    const headerRow = document.getElementById('headers');
    
    // Clear previous data
    container.innerHTML = "";
    headerRow.innerHTML = "";

    // Identify Dimensions and Measures
    const dimension = queryResponse.fields.dimension_like[0];
    const measure = queryResponse.fields.measure_like[0];

    if (!dimension || !measure) {
       element.innerHTML = "Please provide at least one dimension and one measure.";
       return done();
    }

    // Set Headers
    headerRow.innerHTML = `<th>${dimension.label_short}</th><th>${measure.label_short}</th>`;

    // Find max value for scaling the bars
    const maxValue = Math.max(...data.map(row => row[measure.name].value));

    // Render Rows
    data.forEach(row => {
      const tr = document.createElement('tr');

      // 1. Dimension Column (The Text)
      const tdLabel = document.createElement('td');
      tdLabel.className = 'label-cell';
      tdLabel.innerText = row[dimension.name].value;
      
      // Trigger Drill Menu on Click
      tdLabel.onclick = (event) => {
        LookerCharts.Utils.openDrillMenu({
          links: row[dimension.name].links,
          event: event
        });
      };
      tr.appendChild(tdLabel);

      // 2. Measure Column (The Pink Bar)
      const tdBar = document.createElement('td');
      const val = row[measure.name].value;
      const pct = (val / maxValue) * 100;

      tdBar.innerHTML = `
        <div class="bar-wrapper">
          <div class="bar-background">
            <div class="bar-fill" style="width: ${pct}%"></div>
          </div>
          <span class="bar-value">${val.toLocaleString()}</span>
        </div>
      `;

      // Trigger Drill Menu when Bar is clicked
      tdBar.onclick = (event) => {
        LookerCharts.Utils.openDrillMenu({
          links: row[dimension.name].links,
          event: event
        });
      };

      tr.appendChild(tdBar);
      container.appendChild(tr);
    });

    done();
  }
});
