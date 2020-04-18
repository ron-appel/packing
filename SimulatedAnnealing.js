"use strict"

// return random integer between 0 and N-1, with potential bias (<1: prefers lower indices, =1: uniform, >1: prefers higher indices)
const random_index = ( N, bias = 1.0 ) => Math.min(N-1, Math.floor(Math.pow(Math.random(), 1/bias) * N))

// function anneal( ... )
// args:
//   f: proposed_cost = get_proposal(iter, epoch)
//   f: set_proposal(is_accepted)
//   initial_cost
//   num_iters, num_epochs

function anneal( get_proposal, set_proposal, num_iters = 100, num_epochs = 1 ) {

  var cost = Infinity

  // epochs (outer loop)
  for (let epoch = 0; epoch < num_epochs; epoch++) {

    // iterations (inner loop)
    for (let i = 1; i <= num_iters; i++) {

      // get new proposal and corresponding cost
      const proposed_cost = get_proposal(i, epoch)

      // compute probability of accepting proposal:
      //   if cost is reduced, prob > 1 and will always accept.
      //   if cost increases, the greater the increase, the lower the probability of accept.
      //   the later the iteration, the more negative the "multiplier" -log(i +1), corresponding to a lower "annealing temperature"
      //     and hence, the lower the probability of moving to a higher cost
      const accept_probability = Math.exp((cost - proposed_cost) * Math.log1p(i))

      // if chance decides, accept proposal
      const is_accepted = Math.random() < accept_probability

      // update total cost; set proposal as accepted/rejected
      if (is_accepted) cost = proposed_cost
      set_proposal(is_accepted)
    }
  }
}
