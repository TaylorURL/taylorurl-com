/**
 * Lets a script import the site's own modules under plain Node.
 *
 * The site's modules import each other without an extension, which the bundler
 * resolves and Node on its own does not. Once this is installed, a relative
 * import written without one is resolved with `.js` supplied on the way
 * through, and every other import is resolved as it was written. A check that
 * asks the site something in a child process installs it there too, before the
 * child imports anything of the site's.
 */
import { registerHooks } from 'node:module'

/** Supplies the `.js` a relative import was written without, for the rest of the process. */
export function allowExtensionlessImports() {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const relative = specifier.startsWith('.')
      const spelled = relative && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.js` : specifier
      return nextResolve(spelled, context)
    },
  })
}
