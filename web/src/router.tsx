import { createBrowserRouter } from "react-router";
import { Welcome } from "./views/Welcome";
import Login from "./views/Auth/Login";
import Register from "./views/Auth/Register";
import ResetPassword from "./views/Auth/ResetPassword";
import AcceptInvitation from "./views/AcceptInvitation";
import DashboardLayout from "./components/layouts/Dashboard";
import Dashboard from "./views/Dashboard/Dashboard";
import Instance from "./views/Dashboard/[id]/Instance";
import Make from "./views/Dashboard/Make";
import Ressources from "./views/Dashboard/Ressources";
import Library from "./views/Dashboard/Library";
import Api from "./views/Dashboard/Api";
import Settings from "./views/Dashboard/Settings";
import Documentation from "./views/Dashboard/Documentation";

export const router = createBrowserRouter([
    {
        path: "/",
        children: [
            { index: true, element: <Welcome /> },
            { path: "login", element: <Login /> },
            { path: "register", element: <Register /> },
            { path: "reset-password", element: <ResetPassword /> },
            { path: "accept-invitation/:token", element: <AcceptInvitation /> }
        ]
    },
    {
        path: "/dashboard",
        element: <DashboardLayout />,
        children: [
            {
                index: true,
                element: <Dashboard />
            },
            {
                path: "instances",
                element: <div className="text-white"><h1 className="text-3xl font-bold mb-4">Instances N8N</h1><p className="text-gray-400">Gérez vos instances N8N</p></div>
            },
            {
                path: "instances/:uuid",
                element: <Instance />
            },
            {
                path: "ai-make",
                element: <Make />
            },
            {
                path: "resources",
                element: <Ressources />
            },
            {
                path: "library",
                element: <Library />
            },
            {
                path: "documentation",
                element: <Documentation />
            },
            {
                path: "api",
                element: <Api />
            },
            {
                path: "settings",
                element: <Settings />
            }
        ]
    }
])