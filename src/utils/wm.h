#ifndef WM_H
#define WM_H
#include <X11/Xlib.h>
#include <X11/Xproto.h>

#include "list.h"

typedef struct {
  Display* dpy;
  Window root;
  List * windows;
  int screen;
} Wm;



#endif
