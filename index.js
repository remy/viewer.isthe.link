const root = document.documentElement;
const viewer = document.getElementById('viewer');
const filePicker = document.getElementById('filePicker');
const assets = [];
const starred = [];

let index = -1;
let url = null;
let nextImage = null;
let timer = null;

const viewable = f => /.(jpe?g)$/i.test(f.name);

async function load(item, img, url) {
  let p = Promise.resolve(item);
  if (typeof item.file === 'function') {
    p = new Promise(resolve => {
      item.file(resolve);
    });
  }

  return p.then(file => {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {}
    url = URL.createObjectURL(file);
    img.src = url;
    img.alt = item.fullPath || item.webkitRelativePath;
    return { img, item };
  });
}

async function show() {
  const item = assets[index];
  if (!item) {
    console.log('no item', index);
    return;
  }
  document.title = `${index + 1} / ${assets.length} images`;
  let img = nextImage;
  if (!img) {
    const { img: _img } = await load(item, new Image(), url);
    img = _img;
  }
  viewer.innerHTML = '';
  viewer.dataset.filename = img.alt;
  if (starred.includes(index)) viewer.dataset.filename += ' ⭐️';
  viewer.appendChild(img);
}

function toggleFullScreen() {
  if (!document.mozFullScreen && !document.webkitFullScreen) {
    if (document.body.mozRequestFullScreen) {
      document.body.mozRequestFullScreen();
    } else {
      document.body.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
    }
  } else {
    if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else {
      document.webkitCancelFullScreen();
    }
  }
}

async function scanFiles(item) {
  if (viewable(item)) {
    assets.push(item);
    document.title = `${assets.length} images`;
  }

  if (item.isDirectory) {
    return new Promise(resolve => {
      item.createReader().readEntries(async entries => {
        Promise.all(entries.map(async entry => await scanFiles(entry))).then(
          resolve
        );
      });
    });
  }
}

root.addEventListener('dragover', event => event.preventDefault(), false);

filePicker.onchange = () => {
  Array.from(event.target.files).forEach(file => assets.push(file));
  sort();
  show();
};

root.addEventListener(
  'drop',
  async event => {
    event.preventDefault();

    const items = Array.from(event.dataTransfer.items);
    await Promise.all(
      items.map(item => item.webkitGetAsEntry()).map(item => {
        if (item) {
          return scanFiles(item);
        }
      })
    );

    sort();
    next();
  },
  false
);

async function next() {
  index++;
  if (index === assets.length) index = 0;
  show();

  if (assets[index + 1]) {
    const { img } = await load(assets[index + 1], new Image());
    nextImage = img;
  } else {
    nextImage = null;
  }
}

async function prev() {
  if (index === 0) index = assets.length;
  index--;
  nextImage = null;
  show();
}

function sort() {
  assets.sort((a, b) => {
    return a.name < b.name ? -1 : 1;
  });
}

root.addEventListener('dblclick', toggleFullScreen, false);
root.addEventListener('click', next, false);

root.addEventListener('keydown', e => {
  if (e.keyCode === 37) {
    prev();
  } else if (e.keyCode === 39) {
    next();
  } else if (e.keyCode === 70) {
    toggleFullScreen();
  } else if (e.keyCode === 83) {
    // s = star
    if (starred.includes(index)) {
      // remove
      starred.splice(starred.indexOf(index), 1);
    } else {
      starred.push(index);
    }
    show();
  } else if (e.keyCode === 68) {
    // d = download
    const item = assets[index];
    item.file(file => {
      const scrBlob = new Blob([file], {
        'content-type': 'application/binary',
      });
      const url = URL.createObjectURL(scrBlob);

      const a = document.createElement('a');
      a.download = file.name;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    });
  } else if (e.keyCode === 65) {
    // a = auto play
    if (timer) {
      clearInterval(timer);
    } else {
      timer = setInterval(next, 2000);
    }
  }
});
