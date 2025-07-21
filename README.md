# A drawer component

An iOS style, gesture-enabled drawer component. This is a repo created to support movie-show-time experience.

### Features
- Support pull down to dismiss gesture
- Robust gesture interruption/redirection in all stages
- Seamlessly blend scroll and gesture dismiss
- Performant: uses native css animation and transition

### Hacks that makes interruption of CSS transition possible
This project ran into a performance throttle problem when implementing interruption (catching the drawer mid-action).

For performance consideration, This system uses CSS transform transition to aniamte the before/after state, not javascript. For example: It would animate between 753px and 0px (because the screen height is 753p), but never 0, 0.1, 0.2... 752px. This creates a problem: catching a moving drawer become very diffcault, as I cannot directly know the position of moving drawer when the finger put on it. 

Initially, I used the element computedStyle to capture in-flight position, so when the finger hold onto it, the drawer will just freeze at that in-flight position. It works to a certain extent - except mobile browser throttles the capturing and that reading turns out to be always a few frames later. This lag results in a visual jolt, with the drawer being snap back to the position a few frames ago. 

I ended up estimating the interruption point by calculating the duration and easing curve to make the drawer be capture at a few frame later. Preventing the appearance of lag. This worked suprisingly well.

### How did the scroll bounce works?

The scroll bouce was artificially added based on the content scrolling momentum. It was a css Animation with spring animation frame generated every initiation.

### Extras that comes with this repo
- The final also implemented it's own version of framer motion's "AnimatePresence" API.
- Similar to AniamtePresence in framer motion, it allows easy management of exit animation.

### Precedent
There has been precedent of building native style mobile drawer. However, there are specific things that I want that Vaul couldn't provide:
- Seamless blend of scroll and drawer manipulation: Vaul treat them as seperate so you can't scroll to the top and start dismissing. You have to re-initiate the pull down gesture again.
- Interruption/Direction: Vaul didn't allow user interrupt the animation. One it started, it will completes it. Honestly this is a very smart trade-off they made as it turns out to be complicating the system quite a bit.
There has been elements which this drawer experiemnt took as inspiration of approach, but there wasn't any direct copying.

[Vaul](https://github.com/emilkowalski/vaul) by [emilkowalski_.](emilkowalski_).

