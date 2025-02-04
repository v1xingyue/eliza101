import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Post } from "../types/post";
import { Loading } from "../components/Loading";

export function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(
          "https://raw.githubusercontent.com/CreatorsDAO/eliza101/main/docs/posts.json"
        );
        const data = await res.json();
        setPosts(data);
      } catch (error) {
        console.error("Error loading posts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.id}
            to={`/module/${post.id}`}
            className="group block p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-[#FF7A00] dark:hover:border-[#FF7A00] transition-colors"
          >
            <h2 className="text-xl font-semibold text-black dark:text-white group-hover:text-[#FF7A00] transition-colors mb-2">
              {post.title}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {post.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
