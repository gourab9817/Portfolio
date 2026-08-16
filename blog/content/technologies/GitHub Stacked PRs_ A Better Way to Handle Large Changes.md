# GitHub Stacked PRs: A Better Way to Handle Large Changes

There’s a point in every developer’s life when a pull request becomes too large to review comfortably. You start with a simple feature, add a database change, build an API on top of it, update the frontend, add tests, and suddenly GitHub is showing a PR with hundreds or thousands of changed lines.

The usual advice is simple: **“Break the PR into smaller pieces.”**

The problem is that the code itself doesn't always let you do that cleanly. Some changes depend on others. GitHub’s new **Stacked Pull Requests** feature is designed specifically for this situation: breaking a large change into smaller, dependent PRs while keeping those relationships intact.

## The problem with large pull requests

Let's take a fairly common example.

You're working on a new billing system. The work involves introducing a few database tables, adding a billing service, exposing new APIs, and finally connecting everything to the frontend.

The natural implementation order looks something like this:

```text
Database changes
      ↓
Billing service
      ↓
API
      ↓
Frontend
```

You could put all of this into one branch and open a single PR. Technically, nothing is wrong with that.

But now your reviewer has to go through database migrations, backend logic, API contracts, frontend changes, and tests in the same review.

That's where things start getting uncomfortable.

A reviewer may understand the database changes perfectly well, but by the time they reach the frontend, they've already spent a significant amount of time understanding everything that came before it. If something changes in the middle of the implementation, the whole PR becomes harder to reason about.

And this isn't some theoretical problem. Large PRs are one of those things most engineering teams eventually learn to avoid. Teams that work on large codebases often end up creating their own conventions, scripts, or adopting tools specifically to make dependent changes easier to review.

The obvious solution is to create multiple PRs.

Unfortunately, that's where Git starts fighting back.

## The awkward part: the changes depend on each other

Suppose you decide to split the billing feature into three PRs:

```text
PR #1 → Database
PR #2 → Backend/API
PR #3 → Frontend
```

The problem is that PR #2 depends on PR #1, and PR #3 depends on PR #2.

If all three branches are based directly on `main`, the second PR won't contain the database changes it needs, and the third won't contain the API changes it needs.

So developers traditionally end up doing something like this:

```text
main
  └── database
        └── backend
              └── frontend
```

This works.

Until somebody changes the database PR.

Now you need to rebase the backend branch. Then potentially rebase the frontend branch. If the first PR gets merged, the base branches need to be updated again.

After a while, you're spending more time maintaining the stack of branches than actually working on the feature.

This is one of the reasons stacked-diff workflows became popular in engineering teams. Tools such as Graphite built workflows around this exact problem: keep related changes in a stack while allowing each change to be reviewed separately.

GitHub is now bringing this workflow directly into the platform.

## So, what exactly is a Stacked PR?

The idea is actually quite simple.

Instead of creating several independent PRs, you create a sequence of PRs where each one builds on the previous one.

For example:

```text
main
  │
  └── PR #1 — Database
          │
          └── PR #2 — API
                  │
                  └── PR #3 — Frontend
```

Each PR represents a smaller logical change.

PR #1 can be reviewed on its own.

Once that is ready, the reviewer can move to PR #2, which contains the API changes on top of the already-reviewed database work.

Then PR #3 contains only the frontend work.

The important part is that GitHub understands that these PRs belong to the same stack.

You aren't pretending that the changes are independent. You're explicitly telling GitHub:

**These changes depend on each other, and here's the order.**

## What GitHub adds

GitHub's implementation makes the workflow considerably easier to manage.

### 1. You can see where a PR sits in the stack

GitHub provides a Stack Map showing the relationship between the PRs.

So when you're looking at the frontend PR, you can see that it depends on the API PR, which depends on the database PR.

That sounds like a small thing, but it removes one of the annoying parts of working with stacked branches: figuring out how everything is connected.

### 2. Reviewers can focus on one change at a time

This is probably the biggest advantage.

Imagine reviewing a feature with 1,500 changed lines.

Compare that with reviewing:

```text
PR #1 → 150 lines
PR #2 → 250 lines
PR #3 → 300 lines
```

The total amount of code hasn't changed.

But the cognitive load has.

A reviewer can concentrate on one problem at a time instead of trying to understand an entire feature in one sitting.

It also makes review comments more useful. Instead of someone saying:

> "I'm not sure about this whole architecture."

they can discuss a specific layer of the implementation.

### 3. The stack can be updated as changes merge

This is another part that makes the workflow practical.

When a lower PR is merged, GitHub can update the branches above it through cascading rebases.

So you don't have to manually walk through every branch and fix the base relationship yourself.

If you've ever spent 20 minutes fixing a rebase that existed only because another branch was merged, you'll understand why this matters.

### 4. You can merge the stack in order

The PRs still have to respect their dependency order.

GitHub can merge the stack sequentially, so the lower-level changes land before the changes that depend on them.

You can also choose to merge only part of the stack when that's what makes sense.

That is useful when, for example, the database and backend work are ready but the frontend still needs another round of development.

## Where this becomes really useful

The best use cases aren't necessarily massive features. They're changes where the implementation naturally has layers.

For example, consider a database migration.

Instead of one giant PR:

```text
"Move the entire application to the new schema"
```

you could have:

```text
PR #1 → Introduce the new schema
PR #2 → Add dual writes
PR #3 → Move reads to the new schema
PR #4 → Remove the old implementation
```

Or imagine you're replacing an authentication system:

```text
PR #1 → Introduce new authentication interfaces
PR #2 → Implement the new authentication service
PR #3 → Migrate existing endpoints
PR #4 → Update clients
PR #5 → Remove the legacy code
```

Each PR tells a much clearer story.

The same applies to frontend redesigns, API migrations, infrastructure changes, large refactors, and pretty much any feature where one piece needs to exist before another can be built on top of it.

## Why I think this matters even more with AI coding tools

There's another reason stacked PRs are becoming relevant now.

AI coding tools have made writing code faster. The bottleneck is increasingly shifting toward **reviewing that code**.

An AI coding agent can generate a surprisingly large amount of implementation in a short time. That's useful, but nobody wants to review a 3,000-line PR just because an agent managed to produce it in 15 minutes.

The engineering workflow still needs a human somewhere in the loop.

That's where smaller, dependent PRs make a lot of sense.

You could ask an agent to work through a feature as a stack:

```text
PR #1 → Database layer
PR #2 → Service layer
PR #3 → API
PR #4 → Tests
PR #5 → UI
```

The implementation can keep moving while humans review the earlier pieces.

This changes the workflow from:

**AI writes everything → human reviews everything**

to something closer to:

**AI builds incrementally → humans review incrementally**

That's a much more scalable model.

## A few things worth keeping in mind

Stacked PRs aren't automatically better for every change.

For a small bug fix, creating a stack of three PRs would just add unnecessary process.

They make the most sense when:

- The change is large enough to benefit from being split.
- The individual changes have clear boundaries.
- Later changes genuinely depend on earlier ones.
- Multiple people need to review different parts.
- You want development to continue while earlier changes are being reviewed.

There's also a learning curve. Developers who are used to thinking in terms of "branch → PR → merge" will need to get comfortable thinking about a group of dependent PRs as one unit.

But once you start working on larger features, that mental model makes a lot of sense.

## The bigger idea behind Stacked PRs

I don't think the interesting part of GitHub Stacked PRs is simply that GitHub now lets you create dependent branches.

We've always been able to do that with Git.

The interesting part is that GitHub is making the **relationship between those changes visible and manageable**.

A large feature doesn't have to mean a large pull request.

You can have:

```text
One feature
    ↓
Several small PRs
    ↓
Each one independently reviewable
    ↓
All connected through the stack
```

That is a much better representation of how software is actually built.

And as code generation gets faster, this becomes even more important. We don't necessarily need fewer lines of code. We need better ways of understanding, reviewing, and integrating those lines of code.

GitHub Stacked PRs are currently in public preview, so it's still early. But the underlying idea is not new. Developers have been solving this problem manually—and sometimes with third-party tooling—for years.

The interesting part is that GitHub is finally making it a first-class part of the normal pull-request workflow.

And honestly, anything that reduces the number of times a developer has to say **“wait, which branch is this based on?”** is probably worth trying.