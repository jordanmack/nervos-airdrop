import React from 'react';
import './Footer.scss';

function Component()
{
	const html =
	(
		<>
			<footer>
				Copyright &copy; 2021-{new Date().getFullYear()} Nervos Foundation. All rights reserved.
			</footer>
		</>
	);

	return html;
}

export default Component;
