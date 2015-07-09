# Architecture

### App structure :

- database and system interaction [backend](#backend)
- X display management + controller [frontend](x-frontend)
- Http web views + REST service [frontend](web-frontend)

### Important notes :

- Backend sharing should be provided when possible.
  - It implies having a strict sync method for managed directories.
  - Maybe restricted writes on filesystem and only one backend process.
  - Should follow as closely as possible [Freedesktop specifications](http://www.freedesktop.org/wiki/Specifications/).
  - Atomic ops on FileSystem are impossible. There must be a single writer process or deadlock prevention settings.
- Desktop manager must be persistent. As in "always on but hidden".
  - Context switch speed
- Applications should be children of the manager.
  - Easier process monitoring
  - logic...

Keep in mind that the most important thing is support for a wide variety of contexts.

###Options

#### media management options

##### Isolated backend that manages files, config & system infos

- REST API accessible from a variety of services
- Easy to add auxiliary services
- Bloated backend that keeps track of everything

##### Single backend managing files. service-wide config storage

- Services must provide a way to share their config when necessary
- Low Redundancy
- High filesystem integrity
- Lighter management as it doesn't have to be fully aware of everything

#### Menu Options
*NOT mutually exclusive. Can be blended.*

##### One app, multiple views
*browser tabs*

- One context
- Fast context switching
- Memory leaks? - not likely
- Consistent programming style

##### One Menu App, Multiple management apps
*think windows menu & native apps*

- Menu can be low level (=faster) as it's simple
- Native apps can switch context easily
- Native apps can be modular (paid options?)

## Structure

### Process structure
```
                 X menu panel(s)
                        ^
                        |
                        v
Playlist    <|                    | HTTP API --> Web Clients
Filesystem  <-->  X manager     <-- Inputs
System calls<|         |
                       v
                  Spawned Apps

```
### Install structure

Controller
  |> Manager
  |> App engines
  |> Backend

### Backend
[Nedb](https://github.com/louischatriot/nedb) Playlist Backend hosted in http://scm.holusion.net/control-model.git.
Backend API abstracts DB to provide convenience methods like ```playlist.next()```;

This has evolved over time to contain much of the backend for the app: System commands, filesystem management, etc...

Can live close to the manager and be separated one day. It's important it stays in js.

### Web Frontend

Located in http://scm.holusion.net/control-http.git.

Dynamically documented with swagger. This doc doesn't implement socket.io routes and as such is not optimal.

Could be transposed to be static-only (and be served on localhost:80) as long as there is some manager to run the server API.

Only connected to the backend. Need to support a PUB-SUB connection with it.

### X manager

Need to switch from displaying a random app to displaying a menu window in no time.
Complete window manager functions with :
- Shortcuts
- App - mime mapping (as in the [freedesktop spec](http://www.freedesktop.org/wiki/Specifications/shared-mime-info-spec/))
- Events forwarding
- Joystick controls

Subsystem of the controller

### X menu panel(s)

- Should launch in less than 100ms on commodity hardware from X manager's context.
- Closely integrated with the manager. Need strong IPC capabilities
- How many panels ?
- Need a clean panel creation method.

[Dbus launch](https://wiki.gnome.org/HowDoI/DBusApplicationLaunching) seems a good option.

### App engines

Should be extensible. Currently statically coded into the controller
