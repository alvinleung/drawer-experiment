import React, {
  createContext,
  isValidElement,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * This is a framer motion style presence managemnet system.
 * The implementation referenced the original, minus a buch of extra framer motion specific feature to keep it light weight.
 *
 * SEE: github.com/motiondivision/motion/blob/main/packages/framer-motion/src/components/AnimatePresence/index.tsx#L92
 *
 */

// 1. when children changes
// 2. diff the change, notify the presence state
// 3. delay its removal until "safe to remove is called"

export function AnimatePresence({ children }: PropsWithChildren) {
  // filter out only React Element, becuase like framer motion,
  // we detect presence via key
  const nextChildren = useMemo(
    () => extractReactElements(children),
    [children],
  );

  // children that we actually render with
  const [outputChildren, setOutputChildren] = useState(nextChildren);

  // the incoming changes
  const nextKeys = useMemo(() => extractKeys(nextChildren), [nextChildren]);

  // the "current state"
  const presentKeys = useRef(new Set<ChildKey>()).current;

  // A list of item to be removed
  const pendingRemovalList = useRef(new Set<ChildKey>()).current;

  const handleExitComplete = useCallback(
    (key: ChildKey) => {
      pendingRemovalList.delete(key);
      setOutputChildren((prev) => {
        return prev.filter((children) => children.key !== key);
      });
    },
    [pendingRemovalList],
  );

  const detectedPresenceChanges = !areSetsEqual(nextKeys, presentKeys);

  if (detectedPresenceChanges) {
    // move all the newly removing keys to the pending list
    const addedKeys = nextKeys.difference(presentKeys);
    const removedKeys = presentKeys.difference(nextKeys);
    for (const key of removedKeys) {
      pendingRemovalList.add(key);
      presentKeys.delete(key);
    }

    // Add the nextKeys to presentKeys. Note that all the removed ones are now in
    // the pending list. presetKeys is now reflecting the upcoming children
    for (const key of addedKeys) {
      presentKeys.add(key);

      // abort the removal since the key is back
      if (pendingRemovalList.has(key)) {
        pendingRemovalList.delete(key);
      }
    }

    // from here on, we update the actual children list based on the diff result
    const nextOutputChildren: React.ReactElement[] = [...nextChildren];

    // Loop through the old list, add exiting item to the new list, and later
    // we can remove it when it completed exit animation
    for (let i = 0; i < outputChildren.length; i++) {
      const child = outputChildren[i];
      const childKey = child.key as ChildKey;
      if (removedKeys.has(childKey)) {
        nextOutputChildren.splice(i, 0, child);
      }
    }

    // right now, the nextOutputChildren should have both the old and new items
    setOutputChildren(nextOutputChildren);

    // return early to refresh the output list
    return null;
  }

  return React.Children.map(outputChildren, (child) => (
    <PresenceChild
      childKey={child.key as ChildKey}
      isPresent={!pendingRemovalList.has(child.key as ChildKey)}
      onCompleteExit={handleExitComplete}
    >
      {child}
    </PresenceChild>
  ));
}

// ==========================================================================
// PRESENCE CHILD
// ==========================================================================
interface PresenceController {
  isPresent: boolean;
  safeToRemove: () => void;
}
interface PresenceContextType {
  initiatePresenceControl: () => PresenceController;
}
const PresenceContext = createContext<PresenceContextType | undefined>(
  undefined,
);

interface PresenceChildProps {
  children: React.ReactNode;
  childKey: ChildKey;
  isPresent: boolean;
  onCompleteExit: (key: ChildKey) => void;
}

function PresenceChild({
  onCompleteExit,
  children,
  childKey,
  isPresent,
}: PresenceChildProps) {
  const isUsingPresenceControl = useRef(false);

  // auto complete the exiting if the user is not using presence control
  useEffect(() => {
    if (!isPresent && !isUsingPresenceControl.current) {
      onCompleteExit(childKey);
    }
  }, [childKey, isPresent, onCompleteExit]);

  const safeToRemove = useCallback(() => {
    onCompleteExit(childKey);
  }, [childKey, onCompleteExit]);

  const initiatePresenceControl = useCallback(() => {
    isUsingPresenceControl.current = true;
    return { isPresent, safeToRemove };
  }, [isPresent, safeToRemove]);

  return (
    <PresenceContext.Provider value={{ initiatePresenceControl }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence(): [boolean, () => void] {
  const context = useContext(PresenceContext);
  if (!context) {
    throw "Presence is not used within a PresenceContext, it will lead to odd result";
  }
  return useMemo(() => {
    const { isPresent, safeToRemove } = context.initiatePresenceControl();
    return [isPresent, safeToRemove];
  }, [context]);
}

// ============================
// UTIL FUNCTIONS
// ============================

function extractReactElements(children: React.ReactNode) {
  const reactElements: React.ReactElement[] = [];

  React.Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }
    reactElements.push(child);
  });

  return reactElements;
}

type ChildKey = number | string;
function extractKeys(elements: React.ReactElement[]) {
  const keys = new Set<ChildKey>();
  for (const element of elements) {
    if (typeof element.key === "string" || typeof element.key === "number") {
      keys.add(element.key);
    }
  }
  return keys;
}

function areSetsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  // Return false immediately if sizes are different
  if (a.size !== b.size) return false;

  // Check if all values in 'a' exist in 'b'
  return [...a].every((value) => b.has(value));
}
