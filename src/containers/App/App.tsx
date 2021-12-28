import './App.scss';
import Footer from '../../components/Footer/Footer';
import Header from '../../components/Header/Header';
import Tool from '../../containers/Tool/Tool';

function App()
{
	let html = 
	(
		<>
			<Header />
			<section className="main">
				<Tool />
			</section>
			<Footer />
		</>
	);

	return html;
}

export default App;
