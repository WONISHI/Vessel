import Layout from './layout'
import { HashRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/home'

function App(): React.JSX.Element {
  return (
    <>
      <HashRouter>
        <Routes>
          <Route path="/" element={<HomePage />}>
            <Route path="/home" element={<Layout />} />
          </Route>
        </Routes>
      </HashRouter>
    </>
  )
}

export default App
