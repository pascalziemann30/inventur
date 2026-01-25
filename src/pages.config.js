import Analytics from './pages/Analytics';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import InventoryCapture from './pages/InventoryCapture';
import Settings from './pages/Settings';
import Suppliers from './pages/Suppliers';
import Users from './pages/Users';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Analytics": Analytics,
    "Dashboard": Dashboard,
    "History": History,
    "InventoryCapture": InventoryCapture,
    "Settings": Settings,
    "Suppliers": Suppliers,
    "Users": Users,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};