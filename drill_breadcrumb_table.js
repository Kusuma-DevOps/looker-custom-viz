looker.plugins.visualizations.add({
  // 1. Define the Edit Panel Options
  options: {
    drill_label_1: {
      type: "string",
      label: "Drill 1 Menu Label",
      default: "By Sub-Category",
      section: "Drill Settings"
    },
    drill_label_2: {
      type: "string",
      label: "Drill 2 Menu Label",
      default: "By Segment",
      section: "Drill Settings"
    },
    bar_color: {
      type: "string",
      label: "Bar Color",
      default: "#E52592",
      display: "color",
      section: "Styling"
    }
  },

  create: function(element, config) {
    element.innerHTML = `
      <style>
        .viz-container { font-family: 'Open Sans', sans-serif; padding: 10px; height: 100%; overflow: hidden; }
        .breadcrumbs { font-size: 13px; margin-bottom: 15px; font-weight: bold; color: #333; }
        .breadcrumb-link { color: #4285F4; cursor: pointer; }
        .viz-table { width: 100%; border-collapse: collapse; }
        .viz-table th { text-align: left; font-size: 11px; color: #707781; border-bottom: 1px solid #EAEAEA; padding: 8px; text-transform: uppercase; }
        .viz-table td { padding: 8px; border-bottom: 1px solid #F5F5F5; font-size: 13px; }
        
        .bar-bg { background: #f0f0f0; height: 20px; width: 100%; position: relative; cursor: pointer; }
        .bar-fill { height: 100%; transition: width 0.4s ease; }
        .bar-label { position: absolute; right: -45px; top: 2px; font-size: 11px; color: #666; }

        /* Custom Mini Menu (0:04 Video Style) */
        .drill-menu-popup {
          position: fixed; background: white; border: 1px solid #d1d1d1;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: none; z-index: 2000;
          min-width: 160px; border-radius: 4px; padding: 5px 0;
        }
        .menu-header { padding: 6px 12px; font-size: 11px; color: #999; border-bottom: 1px solid #eee; }
        .menu-item { padding: 8px 12px; cursor: pointer; font-size: 13px; color: #262D33; }
        .menu-item:hover { background: #F5F7F9; color: #4285F4; }
      </style>
      <div class="viz-container">
        <div id="nav" class="breadcrumbs"></div>
        <div id="mini-menu" class="drill-menu-popup"></div>
        <table class="viz-table">
          <thead><tr id="headers"></tr></thead>
          <tbody id="body"></tbody>
        </table>
      </div>
    `;
    this.currentLevel = 0; // 0, 1, or 2
    this.filterVal = null; // Stores the value clicked (e.g., 'Furniture')
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.data = data;
    this.fields = queryResponse.fields;
    this.config = config;
    this.render();
    done();
  },

  render: function() {
    const body = document.getElementById('body');
    const head = document.getElementById('headers');
    const nav = document.getElementById('nav');
    const menu = document.getElementById('mini-menu');
    body.innerHTML = "";

    const dims = this.fields.dimension_like;
    const meas = this.fields.measure_like[0];

    // 1. Breadcrumbs Logic
    let navHTML = `<span class="breadcrumb-link" id="reset">Step 1</span>`;
    if (this.currentLevel > 0) {
      navHTML += ` <span style="color:#999">></span> <span class="breadcrumb-link" id="go-back">${this.filterVal}</span>`;
    }
    navHTML += ` <span style="color:#999">></span> <span style="color:#000">Current Viz</span>`;
    nav.innerHTML = navHTML;

    // 2. Filter data for the drill level
    let displayData = this.data;
    if (this.currentLevel > 0) {
      displayData = this.data.filter(d => d[dims[0].name].value === this.filterVal);
    }

    // 3. Set Headers
    head.innerHTML = `<th>${dims[this.currentLevel].label_short}</th><th>${meas.label_short}</th>`;

    const maxVal = Math.max(...displayData.map(d => d[meas.name].value));

    // 4. Render Rows
    displayData.forEach(row => {
      const label = row[dims[this.currentLevel].name].value;
      const value = row[meas.name].value;
      const pct = (value / maxVal) * 100;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="width:30%; cursor:pointer;">${label}</td>
        <td style="width:70%;">
          <div class="bar-bg">
            <div class="bar-fill" style="width:${pct}%; background:${this.config.bar_color}"></div>
            <span class="bar-label">${value.toLocaleString()}</span>
          </div>
        </td>
      `;

      // CLICK EVENT: Open Mini Menu
      tr.onclick = (e) => {
        if (this.currentLevel === 0) {
          this.showMenu(e, label, menu);
        }
      };
      body.appendChild(tr);
    });

    // Navigation Click Events
    document.getElementById('reset').onclick = () => { this.currentLevel = 0; this.filterVal = null; this.render(); };
    if (this.currentLevel > 0) {
        document.getElementById('go-back').onclick = () => { this.currentLevel = 0; this.render(); };
    }
    window.onclick = () => menu.style.display = 'none';
  },

  showMenu: function(e, label, menu) {
    e.stopPropagation();
    menu.style.display = 'block';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    menu.innerHTML = `
      <div class="menu-header">Drill into ${label}</div>
      <div class="menu-item" id="opt1">${this.config.drill_label_1}</div>
      <div class="menu-item" id="opt2">${this.config.drill_label_2}</div>
    `;

    document.getElementById('opt1').onclick = () => { this.currentLevel = 1; this.filterVal = label; this.render(); };
    document.getElementById('opt2').onclick = () => { this.currentLevel = 2; this.filterVal = label; this.render(); };
  }
});
