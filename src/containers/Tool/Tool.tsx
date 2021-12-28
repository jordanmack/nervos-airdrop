import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import './Tool.scss';

function Component()
{
	const html =
	(
		<main className="tool">
			😛
			<LoadingSpinner />
		</main>
	);

	return html;
}

export default Component;
