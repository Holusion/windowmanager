#ifndef X_EVENTS_H
#define X_EVENTS_H
#include <X11/Xlib.h>
#include <X11/Xproto.h>
#include "errors.h"
#include "wm.h"
void event_maprequest (XEvent *e,Wm* wm);

#endif
