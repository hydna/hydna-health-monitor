$(document).ready(function() {
  var BASEADDR = "1000000000000000"
  var NO_OF_CHARTS = 4;
  var COLORS = {
    "red":    "244, 52, 0",
    "green":  "166, 219, 0",
    "pink":   "230, 21, 90",
    "purple": "172, 48, 224",
    "blue":   "51, 182, 255",
    "orange": "255, 176, 0",
    "yellow": "255, 215, 0",
    "dgreen": "199, 244, 136"
  }  
  var TIMELINE_OPTIONS = {
    fps: 10,
    title: "",
    maxValueScale: 2,
    grid: {
      fillStyle:'rgba(0,0,0,1)', 
      strokeStyle: 'rgba(0,0,0,0.08)', 
      lineWidth: 1, 
      millisPerLine: 1000, 
      verticalSections: 4 
    }
  };
  var PARAMS_NAMES = {
    "outmsgs": "Outgoing messages per sec",
    "inmsgs": "Ingoing messages per sec",
    "connects": "Connects per sec",
    "disconnects": "Disconnects per sec",
    "conns": "Current connections",
    "cpu": "CPU usage"
  }
  
  var panes = [];

  hydna.onconnect = function() {
  }

  hydna.onconnecterror = function() {
  }

  hydna.onclose = function() {
  }

  $("ul.series-menu li").live("click", function() {
    var self = $(this);
    var parent = self.parent("ul");
    var pane = parent.parent("section");
    var canvasIndex = parent.data("canvasIndex");
    var name = self.attr("rel");
    
    event.preventDefault();
    
    initChart(pane, canvasIndex, name);
        
    $("ul.series-menu li", pane).removeClass("over");
  });
  
  $("ul.series-menu li").live("mouseover", function() {
    var self = $(this);
    var parent = self.parent("ul");
    var pane = parent.parent("section");
    
    $("ul.series-menu li", pane).removeClass("over");
    $(this).addClass("over");
    
  });
  
  var activeSeriesMenu = null;
  
  $("section.monitor canvas").live("click", function(event) {
    var self = $(this);
    var pane = self.parent("section").parent("section");
    var menux = 0;
    var menuy = 0
    
    event.preventDefault();
    
    if ($("ul.series-menu:visible", pane).length) {
      return;
    }
    
    activeSeriesMenu = $("ul.series-menu", pane).show();
    activeSeriesMenu.data("canvasIndex", $("canvas", pane).index(this));
    
    menux = event.layerX - (activeSeriesMenu.width() / 2);
    menuy = event.layerY - (activeSeriesMenu.height() / 2);
    
    activeSeriesMenu.css("left", menux < 16 ? 16 : menux);
    activeSeriesMenu.css("top", menuy < 16 ? 16 : menuy);
    
    function windowClick() {
      if (activeSeriesMenu) {
        activeSeriesMenu.hide();
        activeSeriesMenu = null;
      }
      
      $(window).unbind("click", windowClick);
    }
    
    console.log(event);

    $(window).click(windowClick);
    
    return false;
  });
  
  
  
  function addPane(addr) {
    var connected = false;
    var stream = null;
    var pane = $("section.monitor.tmpl")
                  .clone()
                  .removeClass("tmpl");
    
    panes.push(pane);
    $("content").append(pane);
    

    // Setup stream
    $(".server-select button", pane).click(function() {
      var addr = $(".server-select input", pane).val();
      
      if (!addr || addr.length > 16) {
        alert("Address MUST be 16 chars");
        return;
      }
      
      while (addr.length < 16) {
        addr = "0" + addr;
      }

      stream = hydna.open(BASEADDR + addr, "r");
      
      pane.removeClass("server-select").addClass("connecting");
      
      stream.onopen = function() {
        pane.removeClass("connecting").addClass("status-updates");
      }
      
      stream.ondata = function(data) {
        var graph = JSON.parse(data);
        
        updateTimeSeries(pane, graph);
        
        if (!connected) {
          pane.removeClass("status-updates").addClass("connected");
          connected = true;
          graph.addr = BASEADDR + addr;
          initPane(pane, graph);
        }
      }
      
      stream.onclose = function() {
        
      }
      
    });
    
    onresize();
  }
  
  function updateTimeSeries(pane, graph) {
    var workerSeries = pane.data("series");
    var workers = graph.workers;
    var now = (new Date()).getTime();
    
    if (!workerSeries) {
      pane.data("series", {});
      workerSeries = pane.data("series");
    }

    workers.forEach(function(worker) {
      var pid = worker.pid;
      var stats = worker.stats;
      
      for (var n in stats) {
        if (!workerSeries[n]) {
          workerSeries[n] = {}
        }
        
        if (!workerSeries[n][pid]) {
          workerSeries[n][pid] = new TimeSeries();
        }
        
        workerSeries[n][pid].append(now, stats[n]);
      }
    });
    
    if (pane.data("lastUpdate")) {
      var timeBetweenUpdates = now - pane.data("lastUpdate");
      // $("span.update-interval", pane).text((timeBetweenUpdates / 1000) + "sec");
      $(".stat-indicator", pane).removeClass("wait");
      setTimeout(function() {
        $(".stat-indicator", pane).addClass("wait");
      }, 1500);
    }
    
    pane.data("lastUpdate", now);
  }
  
  function getSeriesNames(pane) {
    var workerSeries = pane.data("series");
    
    if (!workerSeries) return [];
    
    return Object.keys(workerSeries);    
  }
  
  function initChart(pane, index, name) {
    var colorKeys = Object.keys(COLORS);
    var colorIndex = 0;
    var opts = Object.create(TIMELINE_OPTIONS);
    var workerSeries = pane.data("series");
    var chart = null;
    var canvas = $("canvas", pane).eq(index);
    var span = $(".meters span", pane).eq(index);
    
    opts.title = name.toUpperCase();
    span.text(PARAMS_NAMES[name] || name);

    chart = new SmoothieChart(opts);
    
    if (canvas.data("chart")) {
      canvas.data("chart").destroy();
    }

    canvas.data("chart", chart);
    
    for (var pid in workerSeries[name]) {
      var series = workerSeries[name][pid];

      if (--colorIndex < 0) {
        colorIndex = colorKeys.length - 1;
      }

      chart.addTimeSeries(series, { 
        strokeStyle: 'rgba(' + COLORS[colorKeys[colorIndex]] + ', 0.8)', 
        fillStyle: 'rgba(' + COLORS[colorKeys[colorIndex]] + ', 0.00)', 
        lineWidth: 3 
      });
    }
    
    // chart.streamTo(canvas[0], );
    chart.streamTo(canvas[0], pane.data("statsInterval") * 2);
  }
  
  function initPane(pane, values) {
    var colorKeys = Object.keys(COLORS);
    var colorIndex = 0;
    var index = values.workers.length;
    var worker = null;
    var names = null;
    
    $("h1", pane).html(values.name + "<span>" + values.addr + "</span>");
    
    while (index--) {
      worker = values.workers[index];
      
      if (--colorIndex < 0) {
        colorIndex = colorKeys.length - 1;
      }
      
      $(".legend", pane).append('<li><span class="'
                               + colorKeys[colorIndex]
                               + '"></span>'
                               + worker.pid
                               + '</li>');
    }

    pane.data("statsInterval", values.interval);
    
    names = getSeriesNames(pane);
    
    for (var i = 0; i < NO_OF_CHARTS; i++) {
      initChart(pane, i, names[i]);
    }
    
    var selectmenu = ['<ul class="series-menu">'];
    
    names.forEach(function(name) {
      selectmenu.push('<li rel="' + name + '">' + 
                      (PARAMS_NAMES[name] || name) + 
                      '</li>')
    });
    
    selectmenu.push('</ul>');
    
    pane.append(selectmenu.join(''));
    
    onresize();    
  }
  
  function organizePanes() {
    var index = panes.length;
    var width = $("content")[0].clientWidth;
    var height = $("content")[0].clientHeight;
    var paneWidth = width / Math.ceil(index / 2);
    var paneExpWidth = width / (index / 2);
    var paneHeight = height / 2;
    var x = 0;
    
    if (index < 2) return;
    
    for (var i = 0; i < index; i++) {
      if (i % 2 == 0) {
        $(panes[i])
          .css("left", x)
          .css("top", 0)
          .css("width", paneWidth)
          .css("height", paneHeight)
          .addClass("odd")
          .addClass(i < index - 2 ? "mid" : "")
      } else {
        console.log((((index / 2) % 1)  + 1));
        $(panes[i])
          .css("left", x)
          .css("top", paneHeight)
          .css("width", paneExpWidth * (((index / 2) % 1)  + 1) )
          .css("height", paneHeight)
          .addClass(i < index - 2 ? "mid" : "")
        x += paneWidth;
      }
    }
    
  }
  
  function onresize() {
    organizePanes();

    $("canvas").each(function(index, elem) {
      elem.width = elem.clientWidth;
      elem.height = elem.clientHeight;
    });
  }
  
  
  $(window).bind("resize", onresize);
  
  $("footer button").click(function() {
    addPane();
  });
  
  addPane();
  
});


