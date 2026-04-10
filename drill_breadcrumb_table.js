looker.plugins.visualizations.add({
  create: function(element, config) {
    element.innerHTML = `
      <style>
        .viz-container { height: 100%; display: flex; flex-direction: column; padding: 10px; font-family: sans-serif; }
        .breadcrumbs { font-size: 14px; font-weight: bold; margin-bottom: 20px; color: #333; }
        .breadcrumbs a { color: #4285F4; text-decoration: none; cursor: pointer; }
        .viz-table { width: 100%; border-collapse: collapse; }
        .viz-table th { text-align: left; border-bottom: 1px solid #C1C6CC; padding: 8px; font-size: 12px; color: #707781; text-transform: uppercase; }
        .viz-table td { padding: 10px 8px; border-bottom: 1px solid #EAEAEA; font-size: 13px; }
        .bar-container { background: #f2f2f2; width: 100%; height: 20px; position: relative; cursor: pointer; }
        .bar-fill { background: #E52592; height: 100%; transition: width 0.5s ease; }
        .bar-label { position: absolute; right: -45px; top: 0; font-size: 11px; color: #333; }
        .clickable-cell { color: #262D33; cursor: pointer; font-weight: 500; }
        .clickable-cell:hover { text-decoration: underline; }

        /* Custom Popup Menu Styling */
        .drill-menu {
          position: absolute; background: white; border: 1px solid #ccc; 
          box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 1000; display: none;
          border-radius: 4px; padding: 5px 0; min-width: 150px;
        }
        .drill-menu-item {
          padding: 8px 15px; cursor: pointer; font-size: 13px; color: #333;
        }
        .drill-menu-item:hover { background: #f5f5f5; color: #4285F4; }
      </style>
      <div class="viz-container">
        <div id="breadcrumb-nav" class="breadcrumbs"></div>
        <div id="custom-menu" class="drill-menu"></div>
        <table class="viz-table">
          <thead><tr id="table-headers"></tr></thead>
          <tbody id="table-body"></tbody>
        </table>
      </div>
    `;
    this.currentLevel = 0; // 0 = Category, 1 = Subcategory, 2 = Segment
    this.drillFilter = null;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.data = data;
    this.fields = queryResponse.fields;
    this.renderViz();
    done();
  },

  renderViz: function() {
    const tableBody = document.getElementById('table-body');
    const tableHeaders = document.getElementById('table-headers');
    const nav = document.getElementById('breadcrumb-nav');
    const menu = document.getElementById('custom-menu');

    tableBody.innerHTML = "";
    tableHeaders.innerHTML = "";
    
    const dims = this.fields.dimension_like;
    const meas = this.fields.measure_like[0];

    // 1. Breadcrumbs Logic
    let navHTML = `<a id="back-home">Step 1</a> > `;
    if (this.currentLevel > 0) {
      navHTML += `<a id="back-prev">${this.drillFilter}</a> > `;
    }
    navHTML += `<span style="color:#000">Current Viz</span>`;
    nav.innerHTML = navHTML;

    // 2. Header
    tableHeaders.innerHTML = `<th>${dims[this.currentLevel].label_short}</th><th>${meas.label_short}</th>`;

    // 3. Filter and Group Data
    let displayData = this.data;
    if (this.drillFilter) {
      displayData = this.data.filter(row => row[dims[0].name].value === this.drillFilter);
    }

    // Grouping by current dimension
    const grouped = {};
    displayData.forEach(row => {
      const key = row[dims[this.currentLevel].name].value;
      const val = row[meas.name].value;
      if (!grouped[key]) grouped[key] = 0;
      grouped[key] += val;
    });

    const maxVal = Math.max(...Object.values(grouped));

    // 4. Render Rows
    Object.keys(grouped).forEach(key => {
      const tr = document.createElement('tr');
      const val = grouped[key];
      const pct = (val / maxVal) * 100;

      tr.innerHTML = `
        <td class="clickable-cell">${key}</td>
        <td>
          <div class="bar-container">
            <div class="bar-fill" style="width: ${pct}%"><span class="bar-label">${val.toLocaleString()}</span></div>
          </div>
        </td>
      `;

      // CLICK EVENT: Show Custom Menu
      tr.onclick = (e) => {
        if (this.currentLevel === 0) {
          this.showMenu(e, key, menu);
        }
      };
      tableBody.appendChild(tr);
    });

    // Navigation Events
    document.getElementById('back-home').onclick = () => { this.currentLevel = 0; this.drillFilter = null; this.renderViz(); };
    if (this.currentLevel > 0) {
        document.getElementById('back-prev').onclick = () => { this.currentLevel = 0; this.renderViz(); };
    }
    
    // Hide menu on outside click
    window.onclick = () => { menu.style.display = 'none'; };
  },

  showMenu: function(e, value, menu) {
    e.stopPropagation();
    menu.style.display = 'block';
    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';

    menu.innerHTML = `
      <div class="drill-menu-item" id="drill-sub">By Sub Category</div>
      <div class="drill-menu-item" id="drill-seg">By Segment</div>
    `;

    document.getElementById('drill-sub').onclick = () => {
      this.currentLevel = 1;
      this.drillFilter = value;
      this.renderViz();
    };

    document.getElementById('drill-seg').onclick = () => {
      this.currentLevel = 2;
      this.drillFilter = value;
      this.renderViz();
    };
  }
});
