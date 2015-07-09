#ifndef ERRORS_H
#define ERRORS_H
#include <X11/Xlib.h>
#include <X11/Xproto.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>

int xerror(Display *dpy, XErrorEvent *ee);

#endif
