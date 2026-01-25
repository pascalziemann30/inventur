import Dashboard from './pages/Dashboard';
import History from './pages/History';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "History": History,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};