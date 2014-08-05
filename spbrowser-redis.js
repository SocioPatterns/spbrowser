var t;
var delta;
var force;
var w = $(window).width();
var h = $(window).height() - $("#header").height() - 80;


SPbrowser = function () {
    const WEBDIS_URL = "http://localhost:7379/";
    var TIMESTAMP_MIN;
    var TIMESTAMP_MAX;
    var TIMELINE_NODE;
    var DELTAT;
    var RUN_NAME = prompt("Please enter the name of the run:", "REDIS_PROVA");
    $.ajax({
            async: false,
            type: 'POST',
            url: WEBDIS_URL,
            dataType: 'json',
            data: "HMGET/"+RUN_NAME+":run/start_time/stop_time/deltat",
            success: function(data) {
                DELTAT = data.HMGET[2];
                TIMESTAMP_MIN = data.HMGET[0];
                TIMESTAMP_MAX = data.HMGET[1]-delta;
                
            },
            error: function(x, status, error){
                alert("Error: "+x.status+"\nStatus: "+status+"\nError: "+error)
            }
        });
    
    
    


	const MAX_NUM_POINTS = 200;
    
    var nodeArray = [];
    var nodeDict = {};
    var edgeArray = [];

    var param_t1 = TIMESTAMP_MIN;       //to be set to the time start of the caption
    var param_t2 = TIMESTAMP_MAX;       //to be set to the time start of the caption
    var param_wthres = 0;
    
    var vis;
//    var force;

    var plot_timeline_data = [];
    var plot_overview_data = [];

    var plot_timeline_options = {
    	series: {shadowSize: 0,
        	lines: {
            	show: true,
                fill: true,
                fillColor: "#006885",
                lineWidth: 0,
                zero: false
                },
            points: {
            	show: false,
                radius: 2,
                lineWidth: 0.0000001,
                fill: true,
                fillColor: '#222222'
                }
            },
            grid:  { borderWidth: 1, borderColor: "#666666", backgroundColor: "#EEEEEE"},
            xaxis: { mode: "time",
                    //timeformat: "%H:%M",
                    tickFormatter: function (val, axis) {
                        var d = new Date(val);
                        var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                        if (!d.getUTCHours() && !d.getUTCMinutes()) {
                            return '<b>' + d.getUTCDate() + ' ' + monthNames[d.getUTCMonth()] + '</b>';
                        }
                        var h = d.getUTCHours() > 9 ? d.getUTCHours() : '0' + d.getUTCHours();
                        var m = d.getUTCMinutes() > 9 ? d.getUTCMinutes() : '0' + d.getUTCMinutes();
                        return h + ":" + m;
                    }},
            yaxis: {ticks: 2},
            selection: { mode: "x", color: "#333333", strokeOpacity: 0.3, fillOpacity: 0.8 }
        };


    function load_graph (edges) {
        nodeArray.splice(0, nodeArray.length);
        edgeArray.splice(0, edgeArray.length);
        node_presence = {};

        for (i=0; i<edges.length; i++) {
            t1 = edges[i].source;
            t2 = edges[i].target;
            weight = edges[i].weight;


            if (! (t1 in nodeDict))
                nodeDict[t1] = {name: t1, fixed: t1>=1300 };
            if (! (t1 in node_presence)) {
                nodeArray.push(nodeDict[t1]);
                node_presence[t1] = 1;
            }

            if (! (t2 in nodeDict))
                nodeDict[t2] = {name: t2, fixed: t2>=1300 };
            if (! (t2 in node_presence)) {
                nodeArray.push(nodeDict[t2]);
                node_presence[t2] = 1;
            }

            edgeArray.push({source: nodeDict[t1], target: nodeDict[t2], weight: weight});
        }
    }

    function load_timeline(timeline_node, tstart, tstop, max_num_points, callback) {
		est_num_points = Math.ceil((tstop - tstart) / delta)
		alignment = Math.ceil(est_num_points / max_num_points) * 20
		script = encodeURI("local delta = redis.call('HGET', KEYS[1]..':run', 'deltat') / 2; local frames = redis.call('ZRANGEBYSCORE', KEYS[1]..':timeline', ARGV[1] - delta, ARGV[2] + delta - 1, 'WITHSCORES'); local response = {}; for i = 1, #frames, 2 do table.insert(response, {frames[i+1], redis.call('SCARD', frames[i]..':actors')}); end return cjson.encode(response)").replace("/","%2F").replace("+","%2B").replace("+","%2B");
        $.ajax({
            type: 'POST',
            url: WEBDIS_URL,
            dataType: 'json',
            data: "EVAL/"+script+"/1/"+RUN_NAME+"/"+tstart+"/"+tstop,
            success: function(data) {
                ret = JSON.parse(data.EVAL);
                num_nodes_series = [];

                for (var i=0; i<ret.length; i++) {
                    timestamp = ret[i][0];
                    num_nodes = ret[i][1];

                    num_nodes_series.push([timestamp * 1000, num_nodes]);
                 }

                callback(num_nodes_series);
            }
        });
    }


    function init () {
        $.ajax({
            async: false,
            type: 'POST',
            url: WEBDIS_URL,
            dataType: 'json',
            data: "HGET/"+RUN_NAME+":run/stop_time",
            success: function(data) {
                param_t2 = data.HGET-DELTAT;
                TIMESTAMP_MAX = param_t2;
            },
            error: function(x, status, error) {
                alert("Error: "+x.status+"\nStatus: "+status+"\n"+error);
            }
        });
        
        t = $.now();
        t = (t-t%1000) / 1000;
        delta = t - param_t2;
        

        vis = d3.select("#graph-layout")
            .append("svg:svg");

        force = d3.layout.force()
            .charge(-100)
            .friction(0.9)
            .gravity(0.045)
            .linkDistance(150)
            .nodes(nodeArray)
            .links(edgeArray)
            .size([w, h])
            .start();

            force.on("tick",
                function() {
                    vis.selectAll("line.link")
                        .attr("x1", function(d) { return d.source.x; })
                        .attr("y1", function(d) { return d.source.y; })
                        .attr("x2", function(d) { return d.target.x; })
                        .attr("y2", function(d) { return d.target.y; });

                    vis.selectAll("g.node")
                        .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
                        //.attr("cx", function(d) { return d.x; })
                        //.attr("cy", function(d) { return d.y; });
            });


        var plot_timeline = $.plot($("#plot_timeline"), [], plot_timeline_options);

        var plot_overview = $.plot($("#plot_overview"), [], plot_overview_options);

        load_timeline(TIMELINE_NODE, param_t1, param_t2, MAX_NUM_POINTS,
            function (X) {
                plot_timeline = $.plot($("#plot_timeline"), [ X ], plot_timeline_options);
            }
        );

        $("#plot_timeline").bind("plotselected", function (event, ranges) {
            param_t1 = Math.floor(ranges.xaxis.from / 1000);
            param_t2 = Math.ceil(ranges.xaxis.to / 1000);
            $("#param_t1").val(param_t1);
            $("#param_t2").val(param_t2);

            load_timeline(TIMELINE_NODE, param_t1, param_t2, MAX_NUM_POINTS,
            function (X) {
                if (param_t2-param_t1<6000) {
                    plot_timeline_options.series.points.show = true;
                    plot_timeline_options.series.points.radius = 2.5;
                } else if (param_t2-param_t1<12000) {
                    plot_timeline_options.series.points.show = true;
                    plot_timeline_options.series.points.radius = 2;
                } else {
                    plot_timeline_options.series.points.show = false;
                }
				plot_timeline = $.plot($("#plot_timeline"), [ X ], plot_timeline_options);
            });

            load_cumulative_network(TIMELINE_NODE, param_t1, param_t2, param_wthres);

            plot_overview.setSelection(ranges, true);
        });


        var plot_overview_options = {
            series: {shadowSize: 0,
                     lines: {
                        fillColor: "#006885",
                        fill: true,
                        lineWidth: 0,
                        zero: false
                     }
                    },
            xaxis: {mode: "time", timeformat: "%d %b", ticks: 3, position: 'bottom' },
            yaxis: {show: true, ticks: 1},
            grid:  {borderWidth: 1, borderColor: "#666666", backgroundColor: "#EEEEEE"},
            markings: [ { xaxis: { from: 0, to: 2 }, yaxis: 0}],
            selection: { mode: "x", color: "#333333", strokeOpacity: 0.3, fillOpacity: 0.8 }
        };

        load_timeline(TIMELINE_NODE, TIMESTAMP_MIN, TIMESTAMP_MAX, MAX_NUM_POINTS,
            function (X) {
                plot_overview = $.plot($("#plot_overview"), [ X ], plot_overview_options);
            }
        );

        $("#plot_overview").bind("plotselected", function (event, ranges) {
            param_t1 = Math.floor(ranges.xaxis.from / 1000);
            param_t2 = Math.ceil(ranges.xaxis.to / 1000);
            $("#param_t1").val(param_t1);
            $("#param_t2").val(param_t2);

            load_cumulative_network(TIMELINE_NODE, param_t1, param_t2, param_wthres);

            plot_timeline.setSelection(ranges);
        });
        

		//plot_overview.setSelection({ xaxis: { from: param_t1 * 1000.0, to: param_t2 * 1000.0}}, true);
        
        $("#param_t1").val(param_t1);
        $("#param_t1").keyup(function(event) {if (event.keyCode == 13) { update_param_t1(); }} );
        $("#param_t1").focusout(function(event) { update_param_t1(); } );
        $("#param_t2").change(function(event) { update_param_t1(); } );
        
        $("#param_t2").val(param_t2);
        $("#param_t2").keyup(function(event) {if (event.keyCode == 13) { update_param_t2(); }} );
        $("#param_t2").focusout(function(event) { update_param_t2(); } );
        $("#param_t2").change(function(event) { update_param_t2(); } );

        $("#param_wthres").val(param_wthres);
        $("#param_wthres").keyup(function(event) {if (event.keyCode == 13) { update_param_wthres(); }} );
        $("#param_wthres").focusout(function(event) { update_param_wthres(); } );
        

        load_cumulative_network(TIMELINE_NODE, param_t1, param_t2, param_wthres);
    }
    
    function update_graph () {
        x = vis.selectAll("line.link")
            .data(edgeArray, function(d) { return d.source.name + "-" + d.target.name; })
            .style("stroke-width", function(d) { return Math.pow(d.weight, 0.25); } );

        x.enter().insert("svg:line", "g.node")
            .attr("class", "link")
            .attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; })
            .style("stroke-width", function(d) { return Math.pow(d.weight, 0.25); } )
            .style("stroke-opacity", 1e-6)
            .transition()
            .duration(1000)
            .style("stroke-opacity", 0.8);

        x.exit().transition()
            .duration(500)
            .style("stroke-opacity", 1e-6)
            .remove();

        x = vis.selectAll("g.node").
            data(nodeArray, function(d) { return d.name; });

        node_sel = x.enter().insert("g")
            .attr("class", "node")
            .call(force.drag);

        node_sel.append("svg:circle")
            .attr("class", "node2")
            .attr("r", 2)
            .style("fill-opacity", 1e-6)
            .style("stroke-width", 0)
            .style("fill", "white")
            .transition()
            .duration(1000)
            .style("fill-opacity", 1)
            .style("fill", "#333333");

        node_sel.append("svg:circle")
            .attr("class", "node2")
            .attr("r", 8)
            .style("fill-opacity", 1e-6)
            .style("stroke-width", 0)
            .style("fill", "white")
            .transition()
            .duration(1000)
            .style("fill-opacity", 0.4)
            .style("fill", function(d){
				if (d.name < 1000) return "#006885";
				else if (d.name > 1500) return "#FFFF66";
				else if (d.name >= 1300 && d.name <=1500) return "#B80000";
				else return "#000000"
		});

        node_sel.append("text")
            .attr("dx", 8)
            .attr("dy", ".35em")
            .attr("font-size", "10px")
            .attr("fill-opacity", 1e-6)
            .attr("fill", "#888")
            // .style("pointer-events", "none")
            .text(function(d) { return d.name; })
            .transition()
            .duration(1000)
            .attr("fill-opacity", 1);

        node_sel = x.exit();

        node_sel.selectAll("text")
            .transition()
            .duration(500)
            .style("fill-opacity", 1e-6);

        node_sel.selectAll("circle")
            .transition()
            .duration(500)
            .style("fill-opacity", 1e-6)
            .style("stroke-opacity", 1e-6);

        node_sel.call(function(d) {delete d.x; delete d.y;} )  
            .transition()
            .duration(500)
            .remove();

        force.start();
    }

    function update_param_t1() {
        param_t1 = $("#param_t1").val();

        load_cumulative_network(TIMELINE_NODE, param_t1, param_t2, param_wthres);

        load_timeline(TIMELINE_NODE, param_t1, param_t2, MAX_NUM_POINTS,
           	function (X) {
               	plot_timeline = $.plot($("#plot_timeline"), [ X ], plot_timeline_options);
           	}
        );
    }

    function update_param_t2() {
        param_t2 = $("#param_t2").val();

        load_cumulative_network(TIMELINE_NODE, param_t1, param_t2, param_wthres);

        load_timeline(TIMELINE_NODE, param_t1, param_t2, MAX_NUM_POINTS,
           	function (X) {
               	plot_timeline = $.plot($("#plot_timeline"), [ X ], plot_timeline_options);
           	}
        );
    }

    function update_param_wthres() {
        param_wthres = $("#param_wthres").val();

        load_cumulative_network(TIMELINE_NODE, param_t1, param_t2, param_wthres);
    }
    
    

    function load_cumulative_network(timeline_node, tstart, tstop, weight_thres) {
        script = encodeURI("local delta = redis.call('HGET', KEYS[1]..':run', 'deltat') / 2; local frames = redis.call('ZRANGEBYSCORE', KEYS[1]..':timeline', ARGV[1] - delta, ARGV[2] + delta - 1); local weight = tonumber(ARGV[3]); local frames_interactions_id = {}; for _, frame in pairs(frames) do table.insert(frames_interactions_id, frame..':interactions') end local interactions = redis.call('ZUNIONSTORE', 'query3_temp', #frames_interactions_id, unpack(frames_interactions_id)); local response = {}; local interactions = redis.call('ZREVRANGEBYSCORE', 'query3_temp', '+inf', weight, 'WITHSCORES'); for i=1, #interactions, 2 do local edge = redis.call('HMGET', interactions[i], 'actor1', 'actor2'); table.insert(response, {edge[1], edge[2], tonumber(interactions[i+1])}) end return cjson.encode(response)").replace("/","%2F").replace("+","%2B").replace("+","%2B").replace("+","%2B");
        $.ajax({
            type: 'POST',
            url: WEBDIS_URL,
            dataType: 'json',
            data: "EVAL/"+script+"/1/"+RUN_NAME+"/"+tstart+"/"+tstop+"/"+weight_thres,
            success: function(data) {
                ret = JSON.parse(data.EVAL);
                edge_list = [];

                for (var i=0; i<ret.length; i++)
                    edge_list.push({source: ret[i][0], target: ret[i][1], weight: ret[i][2]});

             load_graph(edge_list);

             update_graph();
            }
        });
    }
    
    return {
        init: init
    };
} ();

function refresh_graph() {
    t = $.now();
    t = (t-t%1000) / 1000;
    timeline_window_shown = 200
    $("#param_t2").val(t-delta);
    $("#param_t2").trigger("change");
    $("#param_t1").val(t-delta-timeline_window_shown);
    $("#param_t1").trigger("change");
}

function resizeContents() {
   	w = $(window).width();
    h = $(window).height() - $("#header").height() - 80;

	$("#graph-layout").css({
	    "width" : w,
	    "height" : h
	}),

	force.size([w, h]).start();

}

$(window).resize(resizeContents);
$(window).ready(function(e){
    SPbrowser.init();
    resizeContents();
    setInterval("refresh_graph()", 2000);
});

