import logo from './logo.svg';
import './App.css';
import "@cloudscape-design/global-styles/index.css"

import AppLayout from '@cloudscape-design/components/app-layout';
import { Content } from './components/Content.tsx';

function App() {
  return (
    <div className="App">
      <AppLayout 
        content={<Content />}
        toolsHide={true}
        navigationHide={true}
        />
    </div>
  );
}

export default App;
