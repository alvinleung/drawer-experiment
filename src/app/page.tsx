"use client";

import { Drawer } from "@/components/drawer";
import { AnimatePresence } from "@/components/presence";
import { useState } from "react";

export default function DrawerPage() {
  const [isShowingDrawer, setIsShowingDrawer] = useState(false);
  return (
    <div className={``}>
      <button
        className="p-8 bg-gray-700 rounded-2xl "
        onClick={() => {
          setIsShowingDrawer(true);
        }}
      >
        Open Drawer
      </button>
      <button className="p-8 bg-gray-700 active:bg-amber-400 rounded-2xl ">
        dummy button
      </button>
      <AnimatePresence>
        {isShowingDrawer && (
          <Drawer
            key={"drawer"}
            onDismiss={() => {
              setIsShowingDrawer(false);
            }}
          >
            <Content />
          </Drawer>
        )}
      </AnimatePresence>
    </div>
  );
}

const Content = () => {
  return (
    <div className="w-full px-4 py-6 space-y-12">
      <section className="text-center">
        <h1 className="text-3xl font-bold mb-2">Welcome to Wanderly</h1>
        <p className="text-gray-600">
          Explore new places, hidden gems, and stories worth remembering.
        </p>
      </section>

      <section className="bg-gray-100 p-4 rounded-xl space-y-4">
        <h2 className="text-xl font-semibold">Discover Hidden Gems</h2>
        <p className="text-gray-700">
          From cobblestone streets to quiet cafes tucked behind gardens, the
          world is full of surprises. Whether you&apos;re venturing into unknown
          neighborhoods or revisiting favorite cities, there&apos;s always
          something something unexpected waiting around the corner.
        </p>
        <p className="text-gray-700">
          Our curated guides lead you through local favorites, unspoken secrets,
          and places where magic lingers in the air. Slow down, wander freely,
          and let the world show you what it’s been hiding.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">A Moment in the Mountains</h2>
        <p className="text-gray-600 text-sm">
          “The wind whispered between the peaks as if telling stories only the
          stars could understand.”
        </p>
      </section>

      <section className="bg-white p-4 shadow rounded-lg space-y-4">
        <h2 className="text-xl font-semibold">Tips for Solo Travel</h2>
        <ul className="list-disc list-inside text-gray-700 space-y-2">
          <li>
            Keep a handwritten journal to document your thoughts and sketches.
          </li>
          <li>
            Wake up early—cities feel different before the world fully wakes.
          </li>
          <li>Talk to strangers (safely). Stories live in other people.</li>
          <li>Use downtime for reflection, not just scrolling.</li>
        </ul>
      </section>

      <section className="text-center py-10">
        <h2 className="text-2xl font-bold mb-4">
          Ready to Start Your Journey?
        </h2>
        <p className="text-gray-600 mb-6">
          There’s a world waiting for you. You just need to take the first step.
        </p>
        <button className="bg-blue-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-blue-700 transition">
          Begin Exploring
        </button>
      </section>
    </div>
  );
};
