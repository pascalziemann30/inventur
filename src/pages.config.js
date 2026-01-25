import Dashboard from './pages/Dashboard';
import History from './pages/History';
import InventoryCapture from './pages/InventoryCapture';
import Suppliers from './pages/Suppliers';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "History": History,
    "InventoryCapture": InventoryCapture,
    "Suppliers": Suppliers,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};