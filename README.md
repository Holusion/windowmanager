# WindowManager

Manages display.

Acquire the root window then talks to X11 to manage windows creation/remapping/destruction

Also has the ability to manage child processes via [xdg-apps](https://www.npmjs.com/package/xdg-apps)

A child process is considered "dead" when it's original PID is killed and the created window doesn't exist anymore.
