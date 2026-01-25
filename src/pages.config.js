import Dashboard from './pages/Dashboard';
import History from './pages/History';
import InventoryCapture from './pages/InventoryCapture';
import Suppliers from './pages/Suppliers';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';
import Users from './pages/Users';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "History": History,
    "InventoryCapture": InventoryCapture,
    "Suppliers": Suppliers,
    "Settings": Settings,
    "Analytics": Analytics,
    "Users": Users,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};