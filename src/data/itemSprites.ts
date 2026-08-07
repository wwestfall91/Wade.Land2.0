const spriteModules = import.meta.glob<string>(
  '../assets/sprites/items/*.{png,gif,jpg,jpeg,webp}',
  {
    eager: true,
    import: 'default',
    query: '?url',
  },
)

export const itemSprites = new Map(
  Object.entries(spriteModules).map(([path, url]) => {
    const filename = path.split('/').at(-1) ?? ''
    const name = filename.replace(/\.[^.]+$/, '').toLocaleLowerCase()
    return [name, url]
  }),
)
