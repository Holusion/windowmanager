# WindowManager

Manages display.

Acquire the root window then talks to X11 to manage windows creation/remapping/destruction

Also has the ability to manage child processes via [xdg-apps](https://www.npmjs.com/package/xdg-apps)

A child process is considered "dead" when it's original PID is killed and the created window doesn't exist anymore.

## Dependencies

`fontconfig` is used to provide fonts (but the program should not crash in its absence).
`python` and `build-essential` are required at install time for node-gyp to compile `abstract-socket`.


## Resources

A good example of window manager code is [Openbox](https://github.com/danakj/openbox/blob/master/openbox/) in C.

Otherwise, the [Xlib documentation](https://tronche.com/gui/x/xlib/) might be of use.

The [ICCM spec](https://x.org/releases/X11R7.6/doc/xorg-docs/specs/ICCCM/icccm.html) provides a lot of implementation details that are loosely followed to various degrees.


