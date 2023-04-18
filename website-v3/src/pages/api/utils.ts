import { map, atom } from 'nanostores';

type DirectoryTree = { [path: string]: string };

export const stores = {
  handle: atom<FileSystemDirectoryHandle | null>(null),
  configuration: atom<File | undefined>(undefined),
  docs: atom<FileSystemDirectoryHandle | undefined>(undefined),
  tree: map<DirectoryTree>({}),
  path: atom<string>('/'),
};

// Subscribes to the directory handle the user provided access for,
// and updates the configuration and docs stores.
stores.handle.subscribe(async directory => {
  if (directory) {
    for await (const entry of directory.values()) {
      if (entry.kind === 'file' && ['docs.json', 'docs.yaml'].includes(entry.name)) {
        const file = await entry.getFile();
        stores.configuration.set(file);
      }

      if (entry.kind === 'directory' && entry.name === 'docs') {
        stores.docs.set(entry);
      }
    }
  } else {
    stores.configuration.set(undefined);
  }
});

// Subscribes to the docs store and updates the tree store.
stores.docs.subscribe(async handle => {
  let id;
  if (handle) {
    id = setInterval(async () => {
      stores.tree.set(await walkDirectoryHandle(handle, ''));
    }, 1000);
  } else {
    clearTimeout(id);
    stores.tree.set({});
  }
});

// Walks the directory handle and returns a tree of file handles.
async function walkDirectoryHandle(
  handle: FileSystemDirectoryHandle,
  prefix: string,
): Promise<DirectoryTree> {
  let tree: DirectoryTree = {};

  for await (const entry of handle.values()) {
    if (entry.kind === 'file') {
      const file = await entry.getFile();
      const text = await file.text();
      tree[`${prefix}/${entry.name}`] = text;
    } else if (entry.kind === 'directory') {
      tree = {
        ...tree,
        ...(await walkDirectoryHandle(entry, `${prefix}/${entry.name}`)),
      };
    }
  }

  return tree;
}
