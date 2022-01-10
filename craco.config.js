const cracoExtendScope = require('@dvhb/craco-extend-scope');
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports =
{
	plugins:
	[
		{
			plugin: cracoExtendScope, options:
			{
				path: 'node_modules'
			}
		}
	],

	webpack:
	{
		configure:
		{
			ignoreWarnings: [/Failed to parse source map.+node_modules/],
			plugins:
			[
				new NodePolyfillPlugin()
			],
			resolve:
			{
				fallback:
				{
					"fs": false,
				},
			},
		},
	},
};
