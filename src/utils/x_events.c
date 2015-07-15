#include "x_events.h"

void event_maprequest (XEvent *e,Wm* wm){
  fprintf(stdout, "MapRequest Event\n");
}
