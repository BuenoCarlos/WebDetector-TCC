import { Outlet } from "react-router";
import Navbar from "../components/navbar";
import Sidebar from "../components/sidebar";

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-slate-50">

      <Sidebar />
      <Navbar />

      <main className="min-h-screen px-4 pb-8 pt-24 sm:ml-64 sm:px-8">
        <Outlet />
      </main>

    </div>
  );
}
