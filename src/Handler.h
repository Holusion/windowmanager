#ifndef  HANDLER_H
#define HANDLER_H

#include <map>
extern "C" {
  #include <X11/Xlib.h>
  #include <X11/Xproto.h>
}

static const char *event_names[] = { "", "", "KeyPress", "KeyRelease",
  "ButtonPress", "ButtonRelease", "MotionNotify", "EnterNotify",
  "LeaveNotify", "FocusIn", "FocusOut", "KeymapNotify",
  "Expose", "GraphicsExpose", "NoExpose", "VisibilityNotify",
  "CreateNotify", "DestroyNotify", "UnmapNotify",
  "MapNotify", "MapRequest", "ReparentNotify", "ConfigureNotify",
  "ConfigureRequest", "GravityNotify", "ResizeRequest",
  "CirculateNotify", "CirculateRequest", "PropertyNotify",
  "SelectionClear", "SelectionRequest", "SelectionNotify",
  "ColormapNotify", "ClientMessage", "MappingNotify"
};

class EventHandler {
 public:
  EventHandler();
  ~EventHandler();
 private:
};
#endif
