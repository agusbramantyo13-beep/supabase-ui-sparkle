import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-[60dvh] items-center justify-center bg-background px-4">
      <div className="text-center">
        <p className="num text-5xl font-semibold tracking-tight text-foreground">404</p>
        <p className="mt-2 text-base text-muted-foreground">Halaman tidak ditemukan</p>
        <a
          href="/"
          className="mt-6 inline-flex tap-target items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
        >
          Kembali ke Beranda
        </a>
      </div>
    </div>
  );

};

export default NotFound;
