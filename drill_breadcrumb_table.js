looker.plugins.visualizations.add({
  // 1. Create the UI and Breadcrumb container
  create: function(element, config) {
    element.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap');
        .viz-container { font-family: 'Open Sans', sans-serif; padding: 15px; color: #333; height: 100%; overflow-y: auto; }
        .breadcrumb-nav { margin-bottom: 15px; font-size: 14px; display: flex; align-items: center; }
        .breadcrumb-item { color: #4285F4; font-weight: bold; cursor: pointer; text-decoration: none; }
        .breadcrumb-item:hover { text-decoration: underline; }
        .breadcrumb-sep { margin: 0 8px; color: #999; }
        .breadcrumb-last { color: #000; font-weight: bold; }
        
        .viz-table { width: 100%; border-collapse: collapse; }
        .viz-table th { text-align: left; font-size: 11px; color: #707781; text-transform: uppercase; border-bottom: 1px solid #EAEAEA; padding-bottom: 8px; }
        .viz-table td { padding: 10px 5px; border-bottom: 1px solid #F5F5F5; }
        
        .label-cell { cursor: pointer; color: #262D33; font-size: 13px; width: 30%; }
        .label-cell:hover { color: #4285F4; text-decoration: underline; }
        
        .bar-wrap { display: flex; align-items: center; width: 70%; }
        .bar-bg { background: #f0f0f0; flex-grow: 1; height: 20px; cursor: pointer; position: relative; }
        .bar-fill { background: #E52592; height: 100%; transition: width 0.4s ease; }
        .bar-text { margin-left: 10px; font-size: 12px; color: #333; width: 70px; }
      </style>
      <div class="viz-container">
        <div id="nav" class="breadcrumb-nav"></div>
        <table class="viz-table">
          <thead><tr id="headers"></tr></thead>
          <tbody id="body"></tbody>
        </table>
      </div>
    `;
    this.drillStack = []; // This tracks where we are (e.g., Furniture > Chairs)
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.allData = data;
    this.fields = queryResponse.fields;
    this.renderViz();
    done();
  },

  renderViz: function() {
    const body = document.getElementById('body');
    const header = document.getElementById('headers');
    const nav = document.getElementById('nav');
    
    body.innerHTML = "";
    header.innerHTML = "";
    nav.innerHTML = "";

    const dims = this.fields.dimension_like;
    const meas = this.fields.measure_like[0];
    const currentLevel = this.drillStack.length; // 0 = Category, 1 = Subcat, etc.

    // 1. Build Breadcrumbs
    let navHTML = `<span class="breadcrumb-item" id="go-home">All</span>`;
    this.drillStack.forEach((step, i) => {
      navHTML += `<span class="breadcrumb-sep">></span><span class="breadcrumb-item drill-back" data-index="${i}">${step.value}</span>`;
    });
    navHTML += `<span class="breadcrumb-sep">></span><span class="breadcrumb-last">Current Viz</span>`;
    nav.innerHTML = navHTML;

    // 2. Set Header for current level
    header.innerHTML = `<th>${dims[currentLevel].label_short}</th><th>${meas.label_short}</th>`;

    // 3. Filter Data based on drill stack
    let filteredData = this.allData;
    this.drillStack.forEach((step, i) => {
      filteredData = filteredData.filter(row => row[dims[i].name].value === step.value);
    });

    // 4. Group data by the current dimension level
    const grouped = {};
    filteredData.forEach(row => {
      const key = row[dims[currentLevel].name].value;
      const val = row[meas.name].value;
      if (!grouped[key]) { grouped[key] = { value: 0, row: row }; }
      grouped[key].value += val;
    });

    const maxVal = Math.max(...Object.values(grouped).map(g => g.value));

    // 5. Render Rows
    Object.keys(grouped).forEach(key => {
      const tr = document.createElement('tr');
      const val = grouped[key].value;
      const pct = (val / maxVal) * 100;

      tr.innerHTML = `
        <td class="label-cell">${key}</td>
        <td>
          <div class="bar-wrap">
            <div class="bar-bg"><div class="bar-fill" style="width: ${pct}%"></div></div>
            <span class="bar-text">${val.toLocaleString()}</span>
          </div>
        </td>
      `;

      // CLICK EVENT: Re-render the same tile for the next level
      tr.onclick = () => {
        if (currentLevel < dims.length - 1) {
          this.drillStack.push({ level: currentLevel, value: key });
          this.renderViz();
        }
      };
      body.appendChild(tr);
    });

    // Handle clicking back in breadcrumbs
    document.getElementById('go-home').onclick = () => { this.drillStack = []; this.renderViz(); };
    document.querySelectorAll('.drill-back').forEach(el => {
      el.onclick = (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'));
        this.drillStack = this.drillStack.slice(0, idx + 1);
        this.renderViz();
      };
    });
  }
});
