{
  "targets": [
    {
      "target_name": "Manager",
      "dependencies":["utils"],
      "sources": [ "src/main.cc","src/Manager.cc" ],
      "cflags":['-std=c++11',"-pedantic"],
      'link_settings': {
        'libraries': [
          '<!@(pkg-config --libs x11)'
        ]
      }
    },
    {
      "target_name":"utils",
      'type': 'static_library',
      'sources':["src/utils/errors.c","src/utils/list.c","src/utils/x_events.c"],
      "cflags":['-std=c99'],
      'link_settings': {
        'libraries': [
          '<!@(pkg-config --libs x11)'
        ]
      }
    }
  ]
}
