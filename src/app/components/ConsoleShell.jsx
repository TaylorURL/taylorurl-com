import '@views/console/console.css'

/**
 * The ground the console and the auth screens sit on.
 *
 * A surface somebody reads figures off for twenty minutes gets one dark field
 * and one faint wash separating the chrome from the work, and nothing that
 * moves: an aurora, a pointer glow and a blueprint grid behind a table are
 * texture competing with the numbers.
 *
 * Children read the standard paper tokens; the console theme scope on the outer
 * element redirects them to dark values through CSS-variable inheritance, so a
 * panel written once is right here as well as on paper.
 */
export default function ConsoleShell({ children }) {
  return (
    <div data-theme="console" className="console-ground">
      {children}
    </div>
  )
}
