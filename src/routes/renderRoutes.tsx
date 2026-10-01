import { Route, type RouteObject } from 'react-router-dom';

/** Converts RouteObject[] (as exported by modules) into <Route> elements so modules can stay declarative. */
export function renderRoutes(routes: RouteObject[]) {
  return routes.map((r, i) => {
    const key = (r.path ?? 'index') + i;
    if (r.index) return <Route key={key} index element={r.element} />;
    return (
      <Route key={key} path={r.path} element={r.element}>
        {r.children ? renderRoutes(r.children) : null}
      </Route>
    );
  });
}
