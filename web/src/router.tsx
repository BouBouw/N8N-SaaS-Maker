import { createBrowserRouter } from "react-router";
import { Welcome } from "./views/Welcome";

export const router = createBrowserRouter([
    {
        path: "/",
        children: [
            { index: true, element: <Welcome /> }
        ]
    }
])