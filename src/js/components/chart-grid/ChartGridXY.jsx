/*
 * ### ChartGridXY
 * Render a grid of N columns by N rows of XY (line, column, dot) charts
*/

var React = require("react");
var PropTypes = React.PropTypes;
var update = require("react-addons-update");

var bind = require("lodash/bind");
var clone = require("lodash/clone");
var filter = require("lodash/filter");
var map = require("lodash/map");
var max = require("lodash/max");
var reduce          = require("lodash/reduce");

/* Helper functions */
var cb_xy = require("../../charts/cb-charts").cb_xy;
var help = require("../../util/helper.js");

/* Renderer mixins */
var ChartRendererMixin = require("../mixins/ChartRendererMixin.js");

var HorizontalGridLines = require("../shared/HorizontalGridLines.jsx");
var HorizontalAxis = require("../shared/HorizontalAxis.jsx");
var VerticalGridLines   = require("../shared/VerticalGridLines.jsx");
var BarGroup            = require("../series/BarGroup.jsx");
var SvgWrapper          = require("../svg/SvgWrapper.jsx");
var XYChart             = require("../chart-xy/XYChart.jsx");
var VerticalAxis        = require("../shared/VerticalAxis.jsx");
var SeriesLabel         = require("../shared/SeriesLabel.jsx");
var scaleUtils          = require("../../util/scale-utils.js");
var seriesUtils         = require("../../util/series-utils.js");
var gridUtils           = require("../../util/grid-utils.js");

/* One `GridChart` will be drawn for every column used in our grid */
var GridChart = require("./GridChart.jsx");

/**
 * ### Component that renders xy charts in a chart grid
 * @property {boolean} editable - Allow the rendered component to interacted with and edited
 * @property {object} styleConfig - Parsed global style config
 * @property {object} displayConfig - Parsed visual display configuration for chart grid
 * @property {object} chartProps - Properties used to draw this chart
 * @instance
 * @memberof ChartGridRenderer
 */
var ChartGridXY = React.createClass({

	propTypes: {
		editable: PropTypes.bool.isRequired,
		styleConfig: PropTypes.object.isRequired,
		displayConfig: PropTypes.shape({
			margin: PropTypes.obj,
			padding: PropTypes.obj
		}).isRequired,
		chartProps: PropTypes.shape({
			chartSettings: PropTypes.array.isRequired,
			data: PropTypes.array.isRequired,
			scale: PropTypes.object.isRequired,
			_grid: PropTypes.object.isRequired
		}).isRequired
	},

	//getInitialState: function() {
	//},

	shouldComponentUpdate: function(nextProps, nextState) {
		// Don't render if data is for some reason unavailable
		if (nextProps.chartProps.data) {
			return true;
		} else {
			return false;
		}
	},

	_xyGridBlock: function(d, i) {
		var props = this.props;

		var elProps = {
			key: i,
			data: d.values,
			colorIndex: props.chartProps.chartSettings[i].colorIndex
		};

		var el = seriesUtils.createSeries("line", elProps);

		// TODO: make this a higher order component called BarChart or similar?
		return [
			<SeriesLabel
				key="label"
				xVal={0}
				text={props.chartProps.chartSettings[i].label}
				colorIndex={props.chartProps.chartSettings[i].colorIndex}
			/>,
			<HorizontalGridLines key="grid" />,
			<HorizontalAxis key="axis" />,
			el
		];
	},

	render: function() {
		var props = this.props;
		var displayConfig = props.displayConfig;
		var margin = displayConfig.margin;
		var styleConfig = props.styleConfig;
		var chartProps = props.chartProps;
		var dimensions = props.dimensions;
		var primaryScale = chartProps.scale.primaryScale;

		var tickFont = styleConfig.fontSizes.medium + "px " + styleConfig.fontFamily;
		var tickTextHeight = help.computeTextWidth("M", tickFont);
		var tickWidths = scaleUtils.getTickWidths(primaryScale, tickFont);

		var chartAreaDimensions = {
			width: (
				dimensions.width - margin.left - margin.right -
				displayConfig.padding.left - displayConfig.padding.right -
				tickWidths.max
			),
			height: (
				dimensions.height - margin.top - margin.bottom -
				((displayConfig.padding.top + displayConfig.padding.bottom) * chartProps._grid.rows)
			)
		};

		var outerDimensions = {
			width: dimensions.width,
			height: dimensions.height -
				(displayConfig.padding.top + displayConfig.padding.bottom) * (chartProps._grid.rows - 1)
		}

		// range for all charts in grid (outer)
		var xRangeOuter = [props.styleConfig.xOverTick, chartAreaDimensions.width];
		var yRangeOuter = [chartAreaDimensions.height, 0];

		// place grid elements using gridScales generated by d3
		var gridScales = gridUtils.createGridScales(chartProps._grid, {
			x: xRangeOuter,
			y: yRangeOuter
		}, {
			xInnerPadding: props.displayConfig.gridPadding.xInnerPadding,
			xOuterPadding: props.displayConfig.gridPadding.xOuterPadding,
			yInnerPadding: props.displayConfig.gridPadding.yInnerPadding,
			yOuterPadding: props.displayConfig.gridPadding.yOuterPadding
		});

		var xRangeInner = [0, gridScales.cols.rangeBand()];
		var yRangeInner = [gridScales.rows.rangeBand(), props.displayConfig.afterLegend ];
		var xAxis = scaleUtils.generateScale("ordinal", primaryScale, chartProps.data, xRangeInner);
		var yAxis = scaleUtils.generateScale("linear", primaryScale, chartProps.data, yRangeInner);

		var Outer = React.createFactory(XYChart);
		var outerProps = {
			chartType: "xy-gid",
			styleConfig: props.styleConfig,
			displayConfig: displayConfig,
			tickValues: primaryScale.tickValues,
			editable: props.editable,
			xScale: xAxis.scale,
			yScale: yAxis.scale,
			tickTextHeight: tickTextHeight,
			tickFont: tickFont
		};

		var grid = gridUtils.makeMults(Outer, outerProps, chartProps.data, gridScales, this._xyGridBlock);

		// create vertical axis and grid lines for each row.
		// this should possibly be part of the grid generation
		// and could be its own wrapper component
		var verticalAxes = map(gridScales.rows.domain(), function(row, i) {
			var yPos = gridScales.rows(i);
			return (
				<g
					className="axis grid-row-axis"
					key={"grid-row-" + i}
					transform={ "translate(" + [0, yPos] + ")" }
				>
					<VerticalAxis
						tickWidths={tickWidths.widths}
						tickValues={primaryScale.tickValues}
						dimensions={chartAreaDimensions}
						styleConfig={props.styleConfig}
						displayConfig={displayConfig}
						xScale={xAxis.scale}
						yScale={yAxis.scale}
						tickTextHeight={tickTextHeight}
						tickFont={tickFont}
					/>
				</g>
			)
		});
		return (
			<SvgWrapper
				outerDimensions={outerDimensions}
				metadata={props.metadata}
				displayConfig={displayConfig}
				styleConfig={props.styleConfig}
			>
			<g
				className="grid-wrapper"
				transform={ "translate(" + [0, displayConfig.padding.top] + ")" }
			>
				{verticalAxes}
				<g
					className="grid-charts"
					transform={ "translate(" + [tickWidths.max, 0] + ")" }
				>
					{grid}
				</g>
			</g>
			</SvgWrapper>
		);
	}
});

module.exports = ChartGridXY;
