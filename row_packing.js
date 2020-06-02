
// convert number x into fraction n/m
function number_to_fraction( x ) {
  let d1 = Infinity, m1 = 0, n1 = 0
  for (let m = 1; m <= 16; m++) {
    for (let n = 1; n <= 16; n++) {
      const d = Math.abs(m/n - x)
      if (d1 > d) { d1 = d, m1 = m, n1 = n }
    }
  }
  return [m1, n1]
}

function Tile( aspect_ratio ) {
  this.l = this.t = 0
  this.h = 1
  this.aspect_ratio = this.area = this.w = aspect_ratio

  this.move_to = function( x, y ) {
    this.l = x
    this.t = y
    return this
  }
  this.move_by = function( x, y ) { return this.move_to(this.l + x, this.t + y) }

  const tile = this
  function update_area() { tile.area = tile.w * tile.h; return tile }
  this.set_width = function( w ) {
    this.w = w
    this.h = w /aspect_ratio
    return update_area()
  }
  this.set_height = function( h ) {
    this.w = h *aspect_ratio
    this.h = h
    return update_area()
  }
  this.scale = function( s ) {
    this.move_to(this.l *s, this.t *s)
    return this.set_width(this.w *s)
  }
}

function generate_tiles( Aspect_Ratios ) {
  const Tiles = new Array(Aspect_Ratios.length)
  Aspect_Ratios.forEach(function( aspect_ratio, i ) { Tiles[i] = new Tile(aspect_ratio) })
  return Tiles
}

function center_tiles( Tiles, frame_width, frame_height ) {
  var left = Infinity, right  = -Infinity,
      top  = Infinity, bottom = -Infinity

  Tiles.forEach(function( tile ) {
    if (left > tile.l) left = tile.l
    if (top  > tile.t)  top = tile.t

    const tile_r = tile.l + tile.w,
          tile_b = tile.t + tile.h
    if (right  < tile_r)  right = tile_r
    if (bottom < tile_b) bottom = tile_b
  })

  const sw = frame_width  / (right - left),
        sh = frame_height / (bottom - top)
  const s = ((sw < sh)? sw : sh)
  const x = (frame_width  - (right + left) *s)/2,
        y = (frame_height - (bottom + top) *s)/2

  Tiles.forEach(function( tile ) { tile.scale(s); tile.move_by(x, y) })
}

function place_tiles( Tiles, Row_Counts ) {
  var k = 0, t = 0
  for (let i = 0; i < Row_Counts.length; i++) {
    const k0 = k

    const row_count = Row_Counts[i], tile = Tiles[k++]
    const h = tile.h

    var w = tile.w
    for (let j = 1; j < row_count; j++) {
      const tile = Tiles[k++]
      tile.set_height(h)
      w += tile.w
    }

    k = k0

    var l = 0
    const s = 1/w
    for (let j = 0; j < row_count; j++) {
      const tile = Tiles[k++]
      tile.scale(s)
      tile.move_to(l, t)
      l += tile.w
    }

    t += h *s
  }
  
  const layout_aspect = 1 / t
  return layout_aspect
}

function anneal_layout( Tiles, frame_ratio ) {
  // initialize as square-ish
  const num_rows  = Math.ceil(Math.sqrt(Tiles.length))
  const row_count = Math.ceil(Tiles.length / num_rows)
  const first_count = ((Tiles.length -1) % row_count) +1
  
  var Row_Counts = new Array(num_rows)
  Row_Counts[0] = first_count
  for (let i = 1; i < num_rows; i++) Row_Counts[i] = row_count

  function clone_counts() {
    const Clone = new Array(Row_Counts.length)
    Row_Counts.forEach(function( count, i ) { Clone[i] = count })
    return Clone
  }

  function expand() {
    const i = rand_int(0, Row_Counts.length)
    const row_count = Row_Counts[i]
    if (row_count <= 1) return false
    const j = rand_int(1, row_count)
    Row_Counts.splice(i, 0, j)
    Row_Counts[i +1] = row_count - j
    return true
  }

  function contract() {
    if (Row_Counts.length <= 1) return false
    const i = rand_int(0, Row_Counts.length -1)
    const row_count = Row_Counts[i]
    Row_Counts.splice(i, 1)
    Row_Counts[i] += row_count
    return true
  }

  function compute_cost( epoch_progress ) {
    const layout_ratio = place_tiles(Tiles, Row_Counts)

    var min_area = Infinity, max_area = 0
    Tiles.forEach(function( tile ) {
      if (min_area > tile.area) min_area = tile.area
      if (max_area < tile.area) max_area = tile.area
    })
    // ensure hard constraint on size-ratio
    const size_ratio = Math.sqrt(min_area / max_area)
    if (size_ratio < Params.min_ratio) return Infinity

    var size_error = 0, tile_index = 0
    for (let i = 0; i < Row_Counts.length -1; i++) {
      tile_index += Row_Counts[i]
      const prev_size = Tiles[tile_index -1].h,
            curr_size = Tiles[tile_index   ].h
      const size_diff = curr_size / prev_size -1
      size_error += Math.max(0, size_diff)**2
    }

    const aspect_error = Math.abs(frame_ratio / layout_ratio - 1)

    const cost = aspect_error + size_error
    return cost
  }

  const num_iterations = 100, num_epochs = 20

  var cost_best = Infinity, Row_Counts_best = clone_counts(), cost
  var undo
  function get_proposal( iter, epoch ) {
    const Saved = clone_counts()
    undo = function() { Row_Counts = Saved }    
    
    const expand_probability = 0.5
    const mutate = (Math.random() < expand_probability)? expand : contract
    mutate()

    const epoch_progress = epoch / (num_epochs -1)
    cost = compute_cost(epoch_progress)
    return cost
  }
  function set_proposal( is_accepted ) {
    if (is_accepted) {
      if (cost_best > cost) { cost_best = cost
                              Row_Counts_best = clone_counts() }
    }
    else undo()
  }

  anneal(get_proposal, set_proposal, num_iterations, num_epochs)
  return Row_Counts_best
}

function set_layout( Tiles, frame_width, frame_height, order_in_out ) {
  const frame_ratio = frame_width / frame_height
  const Row_Counts = anneal_layout(Tiles, frame_ratio)

  const layout_ratio = place_tiles(Tiles, Row_Counts)

  // reorder tiles in-outward
  if (order_in_out) {
    const tile = Tiles[0]
    var k = 0, is_top = false, t = tile.t, b = tile.t
    Row_Counts.forEach(function( row_count ) {
      const tile = Tiles[k], l0 = tile.l

      var y
      if (is_top = !is_top) y = (t -= tile.h)
      else                { y = b; b += tile.h }

      var is_left = true, l = l0, r = l0 + tile.w

      tile.move_to(l0, y)
      for (let i = 1; i < row_count; i++) {
        const tile = Tiles[k +i]
        if (is_left = !is_left) tile.move_to(l -= tile.w, y)
        else                  { tile.move_to(r, y); r += tile.w }
      }
      
      const x = l0 - l
      for (let i = 0; i < row_count; i++) Tiles[k + i].move_by(x, 0)
      k += row_count
    })
  }

  center_tiles(Tiles, frame_width, frame_height)

  return layout_ratio
}

function get_layout( Aspect_Ratios, frame_width, frame_height ) {
  const Tiles = generate_tiles(Aspect_Ratios)
  const order_in_out = true
  set_layout(Tiles, frame_width, frame_height, order_in_out)
  return Tiles
}
