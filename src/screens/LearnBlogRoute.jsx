import React from 'react';
import { useParams } from 'react-router-dom';
import LearnBlogScreen from './LearnBlogScreen';

export default function LearnBlogRoute() {
  const { slug } = useParams();
  return <LearnBlogScreen slug={slug} />;
}
